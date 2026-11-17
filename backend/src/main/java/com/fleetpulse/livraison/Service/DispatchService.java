package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.DispatchDto.*;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.*;
import com.fleetpulse.livraison.Repository.*;
import com.fleetpulse.livraison.Service.EstimationArrivee.Point;
import com.fleetpulse.livraison.Service.Itineraire.Course;
import com.fleetpulse.livraison.Service.RegroupementLots.CommandeEnAttente;
import com.fleetpulse.livraison.Service.RegroupementLots.LotPropose;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Sprint 4 : dispatch par lots, qui remplace l'affectation simple du Sprint 2 bis (conservee si app.dispatch.par-lots=false).
 *
 * <ol>
 *   <li>US-403 : les commandes pretes sans coursier sont regroupees en lots de 1 a 3 (service d'IA, sinon RegroupementLots) ;</li>
 *   <li>US-404 : l'ordre des arrets respecte la duree maximale a bord (Itineraire) ;</li>
 *   <li>US-402 : le lot est propose au meilleur coursier disponible de la zone (ChoixLivreur) ; sans candidat, a un coursier
 *       d'une zone voisine (debordement, offre signalee hors zone) ; sinon le lot attend et passe en alerte apres le delai maximal ;</li>
 *   <li>US-405 : le coursier accepte ou refuse dans le delai ; refus ou expiration : le lot est repropose a un autre coursier.</li>
 * </ol>
 * Un coursier n'a qu'une offre a la fois. Toute affectation passe par CommandeWorkflow (historique, notifications).
 */
@Service @RequiredArgsConstructor @Transactional
public class DispatchService {
    static final int MOTIF_MIN = 5, MOTIF_MAX = 300;

    private final ParametresDispatch parametres;
    private final AffectationMissionService affectationSimple;
    private final LivraisonRepository commandes;
    private final LotRepository lots;
    private final OffreLotRepository offres;
    private final AffectationZoneRepository affectations;
    private final ZoneRepository zones;
    private final LivreurRepository livreurs;
    private final UtilisateurRepository utilisateurs;
    private final CommandeWorkflow workflow;
    private final EntrepotService entrepot;
    private final AuditService audit;
    private final ServiceIa ia;
    private final ApplicationEventPublisher evenements;

    /** Publie apres validation : DiffusionTempsReel previent le coursier qu'une offre l'attend. */
    public record OffreProposee(String livreurEmail, Long offreId, Long commandeId) { }

    // ------------------------------------------------------------------ declencheurs

    /** Commande devenue prete (US-2B5). */
    public void commandePrete(Livraison commande) {
        if (!parametres.parLots()) { affectationSimple.affecterSiPossible(commande); return; }
        dispatcher(maintenant());
    }

    /** Coursier declare disponible dans l'une de ses zones. */
    public void livreurDisponible(Livreur livreur, Collection<Long> zoneIds) {
        if (!parametres.parLots()) { affectationSimple.affecterCommandesEnAttente(livreur, zoneIds); return; }
        dispatcher(maintenant());
    }

    /** Coursier devenu indisponible : ses offres en attente sont retirees et reproposees. */
    public void livreurIndisponible(Livreur livreur) {
        if (!parametres.parLots()) return;
        Instant maintenant = maintenant();
        for (OffreLot o : offres.findAllByLivreurIdAndStatutOrderByIdAsc(livreur.getId(), StatutOffre.EN_ATTENTE))
            clore(o, StatutOffre.ANNULEE, maintenant, "Livreur devenu indisponible");
        dispatcher(maintenant);
    }

    /** Cycle periodique (PlanificateurDispatch) ou lance par le responsable : expiration des offres puis reproposition. */
    public CycleVue cycle() {
        Instant maintenant = maintenant();
        int expirees = 0;
        for (OffreLot o : offres.findAllByStatutAndExpireLeBeforeOrderByIdAsc(StatutOffre.EN_ATTENTE, maintenant)) {
            OffreLot offre = offres.verrouiller(o.getId()).orElse(null);
            if (offre == null || offre.getStatut() != StatutOffre.EN_ATTENTE) continue;
            clore(offre, StatutOffre.EXPIREE, maintenant, null);
            offre.getLot().exclure(offre.getLivreur().getId());
            expirees++;
        }
        return new CycleVue(expirees, parametres.parLots() ? dispatcher(maintenant) : 0);
    }

    // ------------------------------------------------------------------ coursier (US-405)

    @Transactional(readOnly = true)
    public List<OffreVue> offres(String email) {
        Livreur livreur = livreur(email);
        Instant maintenant = Instant.now();
        return offres.findAllByLivreurIdAndStatutOrderByIdAsc(livreur.getId(), StatutOffre.EN_ATTENTE).stream()
                .filter(o -> o.getExpireLe().isAfter(maintenant))
                .map(this::offreVue).filter(o -> o.nbCommandes() > 0).toList();
    }

    public LotVue accepter(String email, Long offreId) {
        Livreur livreur = livreur(email);
        OffreLot offre = offreDuLivreur(livreur, offreId);
        if (offre.getStatut() == StatutOffre.ACCEPTEE) return lotVue(offre.getLot());   // rejeu (reseau instable)
        if (offre.getStatut() != StatutOffre.EN_ATTENTE) throw MarketplaceException.conflit("Cette offre n'est plus disponible.");
        Instant maintenant = maintenant();
        if (!maintenant.isBefore(offre.getExpireLe()))
            throw MarketplaceException.conflit("Offre expirée : elle va être proposée à un autre livreur.");
        if (!livreur.estDisponible()) throw MarketplaceException.conflit("Déclarez-vous disponible pour accepter une offre.");

        Lot lot = lots.verrouiller(offre.getLot().getId()).orElseThrow(MarketplaceException::absent);
        List<Livraison> retenues = new ArrayList<>();
        for (Livraison c : commandes.findAllByLotIdOrderByIdAsc(lot.getId())) {
            Livraison commande = commandes.verrouiller(c.getId()).orElseThrow();
            if (commande.getStatut() == StatutLivraison.PRETE && commande.getLivreur() == null) retenues.add(commande);
        }
        if (retenues.isEmpty()) throw MarketplaceException.conflit("Les commandes de cette offre ne sont plus à livrer.");
        long missions = missions(livreur);
        if (missions + retenues.size() > AffectationMissionService.MISSIONS_MAX)
            throw MarketplaceException.conflit("Terminez d'abord vos missions en cours (" + AffectationMissionService.MISSIONS_MAX + " au maximum).");

        offre.setStatut(StatutOffre.ACCEPTEE);
        offre.setReponduLe(maintenant);
        lot.setStatut(StatutLot.ACCEPTE);
        lot.setLivreur(livreur);
        lot.setAccepteLe(maintenant);
        planifier(lot, livreur, retenues);
        String motif = "Lot n°" + lot.getId() + " accepté" + (offre.isHorsZone() ? " (hors zone)" : "");
        for (Livraison c : retenues) affecter(c, livreur, livreur, maintenant, motif);
        entrepot.enregistrer(TypeEvenement.OFFRE, retenues.getFirst().getId(), livreur.getId(), EntrepotService.zoneId(retenues.getFirst()),
                lot.getId(), secondes(offre.getProposeeLe(), maintenant), StatutOffre.ACCEPTEE.name(), retenues.size() + " commande(s)");
        return lotVue(lot);
    }

    public void refuser(String email, Long offreId, RefusOffreRequest r) {
        String motif = r == null || r.motif() == null || r.motif().isBlank() ? null : r.motif().trim();
        if (motif != null && motif.length() > MOTIF_MAX)
            throw new IllegalArgumentException("Motif : " + MOTIF_MAX + " caractères maximum.");
        Livreur livreur = livreur(email);
        OffreLot offre = offreDuLivreur(livreur, offreId);
        if (offre.getStatut() == StatutOffre.REFUSEE) return;   // rejeu
        if (offre.getStatut() != StatutOffre.EN_ATTENTE) throw MarketplaceException.conflit("Cette offre n'est plus disponible.");
        Instant maintenant = maintenant();
        Lot lot = lots.verrouiller(offre.getLot().getId()).orElseThrow(MarketplaceException::absent);
        clore(offre, StatutOffre.REFUSEE, maintenant, motif);
        lot.exclure(livreur.getId());
        dispatcher(maintenant);   // reproposition a un autre coursier
    }

    /** Lots acceptes dont au moins une commande est encore en cours, avec l'itineraire ordonne. */
    @Transactional(readOnly = true)
    public List<LotVue> lotsEnCours(String email) {
        Livreur livreur = livreur(email);
        return lots.findAllByLivreurIdAndStatutOrderByAccepteLeAsc(livreur.getId(), StatutLot.ACCEPTE).stream()
                .filter(l -> commandes.findAllByLotIdOrderByIdAsc(l.getId()).stream()
                        .anyMatch(c -> AffectationMissionService.MISSIONS_EN_COURS.contains(c.getStatut())))
                .map(this::lotVue).toList();
    }

    // ------------------------------------------------------------------ responsable (US-407)

    @Transactional(readOnly = true)
    public SupervisionVue supervision() {
        Instant maintenant = Instant.now();
        List<CommandeAttenteVue> enAttente = commandes.findAllByStatutAndLivreurIsNullOrderByPreteLeAscIdAsc(StatutLivraison.PRETE).stream()
                .map(c -> attenteVue(c, maintenant)).toList();
        List<Lot> recents = lots.findAllByStatutInOrderByIdDesc(List.of(StatutLot.PROPOSE, StatutLot.ACCEPTE));
        List<LotSupervisionVue> vues = new ArrayList<>();
        for (Lot lot : recents) {
            List<Livraison> contenu = commandes.findAllByLotIdOrderByIdAsc(lot.getId());
            boolean actif = lot.getStatut() == StatutLot.PROPOSE
                    ? contenu.stream().anyMatch(c -> c.getStatut() == StatutLivraison.PRETE && c.getLivreur() == null)
                    : contenu.stream().anyMatch(c -> AffectationMissionService.MISSIONS_EN_COURS.contains(c.getStatut()));
            if (!actif) continue;
            vues.add(new LotSupervisionVue(lot.getId(), lot.getStatut(), lot.getSource(),
                    lot.getLivreur() == null ? null : lot.getLivreur().getPrenom(), lot.getCreeLe(), lot.getAccepteLe(),
                    lot.getDistanceKm(), lot.getDureeMinutes(),
                    contenu.stream().map(c -> new CommandeLotVue(c.getId(), c.getCodeSuivi(), c.getStatut())).toList(),
                    offres.findAllByLotIdInOrderByIdAsc(List.of(lot.getId())).stream().map(o -> new OffreHistoriqueVue(o.getId(),
                            o.getLivreur().getPrenom(), o.getStatut(), o.getProposeeLe(), o.getReponduLe(), o.isHorsZone(), o.getScore(),
                            o.getMotifRefus())).toList()));
        }
        List<LivreurSupervisionVue> disponibles = livreurs.findAll().stream().filter(Livreur::estDisponible)
                .sorted(Comparator.comparing(Livreur::getId))
                .map(l -> new LivreurSupervisionVue(l.getId(), l.getPrenom(), l.getNom(), missions(l),
                        offres.existsByLivreurIdAndStatut(l.getId(), StatutOffre.EN_ATTENTE),
                        l.getDerniereLatitude(), l.getDerniereLongitude(), l.getDernierePositionLe())).toList();
        return new SupervisionVue(maintenant, parametres.parLots(), ia.actif(), parametres.delaiOffreSecondes(),
                parametres.delaiRechercheMaxMinutes(), enAttente, vues, disponibles);
    }

    /**
     * US-407 : le responsable impose un coursier pour une commande prete (cas particulier, client prioritaire...).
     * L'offre en cours sur son lot est retiree ; les autres commandes du lot repartent au dispatch.
     */
    public SupervisionVue forcer(String email, Long commandeId, ForcerRequest r) {
        if (r == null || r.livreurId() == null) throw new IllegalArgumentException("Choisissez le livreur.");
        String motif = r.motif() == null ? "" : r.motif().trim();
        if (motif.length() < MOTIF_MIN || motif.length() > MOTIF_MAX)
            throw new IllegalArgumentException("Motif de l'affectation : de " + MOTIF_MIN + " à " + MOTIF_MAX + " caractères.");
        Utilisateur responsable = utilisateurs.findByEmail(email).orElseThrow(MarketplaceException::absent);
        Livraison c = commandes.verrouiller(commandeId).orElseThrow(MarketplaceException::absent);
        if (c.getStatut() != StatutLivraison.PRETE || c.getLivreur() != null)
            throw MarketplaceException.conflit("Seule une commande prête et sans livreur peut être affectée.");
        Livreur livreur = livreurs.findById(r.livreurId()).filter(Livreur::isActif)
                .orElseThrow(() -> new IllegalArgumentException("Livreur introuvable ou inactif."));
        if (missions(livreur) >= AffectationMissionService.MISSIONS_MAX)
            throw MarketplaceException.conflit("Ce livreur a déjà " + AffectationMissionService.MISSIONS_MAX + " missions en cours.");

        Instant maintenant = maintenant();
        Lot ancien = c.getLot();
        if (ancien != null && ancien.getStatut() == StatutLot.PROPOSE) {
            Lot verrou = lots.verrouiller(ancien.getId()).orElseThrow();
            for (OffreLot o : offres.findAllByLotIdAndStatut(verrou.getId(), StatutOffre.EN_ATTENTE))
                clore(o, StatutOffre.ANNULEE, maintenant, "Affectation forcée par le responsable");
            verrou.setStatut(StatutLot.ANNULE);
        }
        Lot lot = new Lot();
        lot.setSource("FORCE");
        lot.setStatut(StatutLot.ACCEPTE);
        lot.setLivreur(livreur);
        lot.setCreeLe(maintenant);
        lot.setAccepteLe(maintenant);
        lots.save(lot);
        c.setLot(lot);
        planifier(lot, livreur, List.of(c));
        affecter(c, livreur, responsable, maintenant, "Affectation forcée par le responsable : " + motif);
        audit.enregistrer(ActionAudit.AFFECTATION_FORCEE, "COMMANDE", c.getId(),
                c.getCodeSuivi() + " → " + livreur.getPrenom() + " " + livreur.getNom() + " : " + motif);
        entrepot.enregistrer(TypeEvenement.AFFECTATION, c.getId(), livreur.getId(), EntrepotService.zoneId(c), lot.getId(), null, "FORCEE", motif);
        dispatcher(maintenant);
        return supervision();
    }

    // ------------------------------------------------------------------ coeur du dispatch

    /** Propose les lots en attente, puis forme et propose de nouveaux lots. Retourne le nombre d'offres creees. */
    int dispatcher(Instant maintenant) {
        int proposees = 0;
        for (Lot lot : lots.findAllByStatutOrderByIdAsc(StatutLot.PROPOSE)) {
            List<OffreLot> enCours = offres.findAllByLotIdAndStatut(lot.getId(), StatutOffre.EN_ATTENTE);
            if (enCours.isEmpty()) {
                if (proposer(lot, maintenant)) proposees++;
            } else if (commandes.findAllByLotIdOrderByIdAsc(lot.getId()).stream()
                    .noneMatch(c -> c.getStatut() == StatutLivraison.PRETE && c.getLivreur() == null)) {
                // Commandes annulees entre-temps : l'offre est retiree, le coursier redevient sollicitable
                enCours.forEach(o -> clore(o, StatutOffre.ANNULEE, maintenant, "Commandes annulées"));
                lot.setStatut(StatutLot.ANNULE);
            }
        }

        List<Livraison> libres = commandes.findAllByStatutAndLivreurIsNullOrderByPreteLeAscIdAsc(StatutLivraison.PRETE).stream()
                .filter(c -> c.getLot() == null || c.getLot().getStatut() == StatutLot.ANNULE)
                .filter(DispatchService::localisee).toList();
        if (libres.isEmpty()) return proposees;
        Instant seuil = maintenant.minusSeconds(Math.max(0, parametres.fenetreRegroupementSecondes()));
        Regroupement regroupement = regrouper(libres, maintenant);
        Map<Long, Livraison> parId = new HashMap<>();
        libres.forEach(c -> parId.put(c.getId(), c));
        for (LotPropose propose : regroupement.lots()) {
            // Fenetre de regroupement : un lot de commandes toutes juste pretes attend un eventuel voisin au prochain cycle
            boolean attendre = propose.commandes().size() < RegroupementLots.TAILLE_MAX
                    && propose.commandes().stream().allMatch(c -> c.prete() != null && c.prete().isAfter(seuil));
            if (attendre) continue;
            // Le lot n'est cree qu'avec un coursier : sans candidat, ses commandes restent libres et pourront
            // etre regroupees avec les suivantes
            List<Livraison> contenu = propose.ids().stream().map(parId::get).filter(Objects::nonNull).toList();
            Optional<ChoixLivreur.Candidat> candidat = choisir(contenu, premiereCollecte(propose.itineraire(), contenu), Set.of(), maintenant);
            if (candidat.isEmpty()) continue;
            LotCree cree = creerLot(propose, regroupement.source(), maintenant);
            if (cree != null) {
                offrir(cree.lot(), cree.commandes(), candidat.get(), maintenant);
                proposees++;
            }
        }
        return proposees;
    }

    /** Lots proposes et moteur qui les a formes (IA ou REGLES), reporte sur chaque lot. */
    record Regroupement(List<LotPropose> lots, String source) { }

    /** US-403 : service d'IA si disponible et coherent, sinon regles. */
    Regroupement regrouper(List<Livraison> libres, Instant maintenant) {
        List<Zone> toutes = zones.findAllByOrderByIdAsc();
        Map<Long, Set<Long>> voisinages = ZoneService.voisinages(toutes);
        double vitesse = libres.stream().mapToDouble(c -> EstimationLivraisonService.vitesse(c.getPartenaire())).min()
                .orElse(Zone.VITESSE_PAR_DEFAUT_KMH);
        List<CommandeEnAttente> attente = libres.stream().map(c -> new CommandeEnAttente(c.getId(), EntrepotService.zoneId(c),
                commerce(c), client(c), c.getPreteLe())).toList();
        Optional<List<LotPropose>> parIa = parIa(attente, voisinages, vitesse, maintenant);
        if (parIa.isPresent()) return new Regroupement(parIa.get(), EstimationLivraisonService.IA);
        return new Regroupement(RegroupementLots.regrouper(attente, voisinages, parametres.rayonCollecteKm(), vitesse, parametres.aBordMax()),
                EstimationLivraisonService.REGLES);
    }

    /** Reponse de l'IA acceptee seulement si chaque commande y figure une fois et si chaque lot respecte les regles. */
    Optional<List<LotPropose>> parIa(List<CommandeEnAttente> attente, Map<Long, Set<Long>> voisinages, double vitesse, Instant maintenant) {
        if (!ia.actif()) return Optional.empty();
        Map<String, List<Long>> voisines = new HashMap<>();
        voisinages.forEach((zone, ids) -> voisines.put(String.valueOf(zone), ids.stream().sorted().toList()));
        var demande = new ServiceIa.DemandeLots(attente.stream().map(c -> new ServiceIa.CommandeIa(c.id(), c.zoneId(),
                new ServiceIa.PositionIa(c.commerce().latitude(), c.commerce().longitude()),
                new ServiceIa.PositionIa(c.client().latitude(), c.client().longitude()),
                c.prete() == null ? 0 : Math.max(0, Duration.between(c.prete(), maintenant).toSeconds()))).toList(),
                voisines, parametres.rayonCollecteKm(), vitesse, parametres.dureeABordMaxMinutes());
        Optional<ServiceIa.ReponseLots> reponse = ia.proposerLots(demande);
        if (reponse.isEmpty()) return Optional.empty();
        Map<Long, CommandeEnAttente> parId = new HashMap<>();
        attente.forEach(c -> parId.put(c.id(), c));
        Set<Long> vues = new HashSet<>();
        List<LotPropose> resultat = new ArrayList<>();
        for (ServiceIa.LotIa lotIa : reponse.get().lots()) {
            if (lotIa.commandes() == null || lotIa.commandes().isEmpty() || lotIa.commandes().size() > RegroupementLots.TAILLE_MAX)
                return Optional.empty();
            List<CommandeEnAttente> contenu = new ArrayList<>();
            for (Long id : lotIa.commandes()) {
                if (!parId.containsKey(id) || !vues.add(id)) return Optional.empty();
                contenu.add(parId.get(id));
            }
            for (CommandeEnAttente c : contenu)
                if (c != contenu.getFirst() && !RegroupementLots.compatible(contenu.getFirst(), c, voisinages, parametres.rayonCollecteKm()))
                    return Optional.empty();
            Optional<Itineraire.Resultat> tournee = Itineraire.optimiser(null, contenu.stream().map(c -> new Course(c.id(), c.commerce(), c.client())).toList(),
                    vitesse, contenu.size() == 1 ? null : parametres.aBordMax());
            if (tournee.isEmpty()) return Optional.empty();
            resultat.add(new LotPropose(List.copyOf(contenu), tournee.get()));
        }
        return vues.size() == attente.size() ? Optional.of(resultat) : Optional.empty();
    }

    /** Lot cree et commandes effectivement rattachees. */
    record LotCree(Lot lot, List<Livraison> commandes) { }

    /** Rattache les commandes encore libres au nouveau lot (verrouillees : un autre cycle peut tourner en meme temps). */
    LotCree creerLot(LotPropose propose, String source, Instant maintenant) {
        Lot lot = new Lot();
        lot.setCreeLe(maintenant);
        lot.setSource(source);
        if (propose.itineraire() != null) {
            lot.setItineraire(propose.itineraire().code());
            lot.setDistanceKm(arrondi(propose.itineraire().distanceKm()));
            lot.setDureeMinutes(minutesArrondies(propose.itineraire().duree()));
        }
        lots.save(lot);
        List<Livraison> rattachees = new ArrayList<>();
        for (Long id : propose.ids()) {
            Livraison c = commandes.verrouiller(id).orElse(null);
            if (c == null || c.getStatut() != StatutLivraison.PRETE || c.getLivreur() != null
                    || (c.getLot() != null && c.getLot().getStatut() != StatutLot.ANNULE)) continue;
            c.setLot(lot);
            rattachees.add(c);
        }
        if (rattachees.isEmpty()) {
            lot.setStatut(StatutLot.ANNULE);
            return null;
        }
        return new LotCree(lot, rattachees);
    }

    /** Lot deja forme (refus, expiration, coursier devenu indisponible) : reproposition. false : aucun candidat. */
    boolean proposer(Lot lot, Instant maintenant) {
        List<Livraison> contenu = commandes.findAllByLotIdOrderByIdAsc(lot.getId()).stream()
                .filter(c -> c.getStatut() == StatutLivraison.PRETE && c.getLivreur() == null).toList();
        if (contenu.isEmpty()) {
            lot.setStatut(StatutLot.ANNULE);
            return false;
        }
        Optional<ChoixLivreur.Candidat> candidat = choisir(contenu, premiereCollecte(lot, contenu), lot.exclus(), maintenant);
        candidat.ifPresent(c -> offrir(lot, contenu, c, maintenant));
        return candidat.isPresent();
    }

    /** US-402 : meilleur coursier disponible de la zone du lot, sinon d'une zone voisine (debordement). */
    Optional<ChoixLivreur.Candidat> choisir(List<Livraison> contenu, Point premiereCollecte, Set<Long> exclus, Instant maintenant) {
        Set<Long> zonesDuLot = new LinkedHashSet<>();
        contenu.forEach(c -> { Long z = EntrepotService.zoneId(c); if (z != null) zonesDuLot.add(z); });
        List<ChoixLivreur.Candidat> candidats = candidats(zonesDuLot, premiereCollecte, contenu.size(), exclus, maintenant, false);
        if (candidats.isEmpty()) {
            Map<Long, Set<Long>> voisinages = ZoneService.voisinages(zones.findAllByOrderByIdAsc());
            Set<Long> voisines = new LinkedHashSet<>();
            zonesDuLot.forEach(z -> voisines.addAll(voisinages.getOrDefault(z, Set.of())));
            voisines.removeAll(zonesDuLot);
            candidats = candidats(voisines, premiereCollecte, contenu.size(), exclus, maintenant, true);
        }
        return ChoixLivreur.meilleur(candidats);
    }

    /** US-405 : offre a accepter avant expiration ; le coursier est prevenu en temps reel. */
    private void offrir(Lot lot, List<Livraison> contenu, ChoixLivreur.Candidat retenu, Instant maintenant) {
        double score = arrondi(ChoixLivreur.score(retenu));
        OffreLot offre = offres.save(new OffreLot(lot, retenu.livreur(), maintenant,
                maintenant.plusSeconds(Math.max(5, parametres.delaiOffreSecondes())), retenu.horsZone(), retenu.distanceKm(), score));
        entrepot.enregistrer(TypeEvenement.OFFRE, contenu.getFirst().getId(), retenu.livreur().getId(), EntrepotService.zoneId(contenu.getFirst()),
                lot.getId(), score, "PROPOSEE", contenu.size() + " commande(s)" + (retenu.horsZone() ? ", hors zone" : ""));
        evenements.publishEvent(new OffreProposee(retenu.livreur().getEmail(), offre.getId(), contenu.getFirst().getId()));
    }

    /** Coursiers des zones donnees, disponibles, sans offre en attente, non exclus du lot et pouvant porter le lot. */
    List<ChoixLivreur.Candidat> candidats(Collection<Long> zoneIds, Point premiereCollecte, int taille, Set<Long> exclus,
                                          Instant maintenant, boolean horsZone) {
        Map<Long, ChoixLivreur.Candidat> parLivreur = new LinkedHashMap<>();
        for (Long zoneId : zoneIds) {
            for (AffectationZone a : affectations.findAllByZoneId(zoneId)) {
                Livreur l = a.getLivreur();
                if (!a.enVigueur(maintenant) || !l.estDisponible() || exclus.contains(l.getId())) continue;
                if (offres.existsByLivreurIdAndStatut(l.getId(), StatutOffre.EN_ATTENTE)) continue;   // une offre a la fois
                long missions = missions(l);
                if (missions + taille > AffectationMissionService.MISSIONS_MAX) continue;
                Double km = l.positionConnue() && premiereCollecte != null
                        ? arrondi(Distances.km(l.getDerniereLatitude(), l.getDerniereLongitude(), premiereCollecte.latitude(), premiereCollecte.longitude()))
                        : null;
                ChoixLivreur.Candidat c = new ChoixLivreur.Candidat(l, horsZone ? null : a.getType(), missions, km);
                parLivreur.merge(l.getId(), c, (x, y) -> ChoixLivreur.score(x) <= ChoixLivreur.score(y) ? x : y);
            }
        }
        return new ArrayList<>(parLivreur.values());
    }

    // ------------------------------------------------------------------ outils

    private void affecter(Livraison c, Livreur livreur, Utilisateur acteur, Instant maintenant, String motif) {
        // Le coursier est renseigne avant la transition : l'evenement temps reel lui est aussi envoye
        c.setLivreur(livreur);
        c.setAffecteeLe(maintenant);
        workflow.transition(c, StatutLivraison.AFFECTEE, acteur, motif);
        entrepot.enregistrer(TypeEvenement.AFFECTATION, c.getId(), livreur.getId(), EntrepotService.zoneId(c),
                c.getLot() == null ? null : c.getLot().getId(), null, "LOT", motif);
    }

    /** US-404 : itineraire recalcule depuis la position du coursier qui prend le lot (sans limite : le lot est deja forme). */
    private void planifier(Lot lot, Livreur livreur, List<Livraison> contenu) {
        Point depart = livreur.positionConnue() ? new Point(livreur.getDerniereLatitude(), livreur.getDerniereLongitude()) : null;
        double vitesse = contenu.stream().mapToDouble(c -> EstimationLivraisonService.vitesse(c.getPartenaire())).min()
                .orElse(Zone.VITESSE_PAR_DEFAUT_KMH);
        Itineraire.optimiser(depart, contenu.stream().filter(DispatchService::localisee)
                .map(c -> new Course(c.getId(), commerce(c), client(c))).toList(), vitesse, null).ifPresent(r -> {
            lot.setItineraire(r.code());
            lot.setDistanceKm(arrondi(r.distanceKm()));
            lot.setDureeMinutes(minutesArrondies(r.duree()));
        });
    }

    private void clore(OffreLot o, StatutOffre statut, Instant maintenant, String motif) {
        o.setStatut(statut);
        o.setReponduLe(maintenant);
        o.setMotifRefus(motif);
        entrepot.enregistrer(TypeEvenement.OFFRE, null, o.getLivreur().getId(), null, o.getLot().getId(),
                secondes(o.getProposeeLe(), maintenant), statut.name(), motif);
    }

    private OffreVue offreVue(OffreLot o) {
        Lot lot = o.getLot();
        List<Livraison> contenu = commandes.findAllByLotIdOrderByIdAsc(lot.getId()).stream()
                .filter(c -> c.getStatut() == StatutLivraison.PRETE && c.getLivreur() == null).toList();
        BigDecimal montant = contenu.stream().map(RemiseLivreurService::montantAttendu).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new OffreVue(o.getId(), lot.getId(), o.getProposeeLe(), o.getExpireLe(), o.isHorsZone(), o.getDistanceLivreurKm(),
                contenu.size(), lot.getDistanceKm(), lot.getDureeMinutes(), montant, etapes(lot, contenu));
    }

    LotVue lotVue(Lot lot) {
        List<Livraison> contenu = commandes.findAllByLotIdOrderByIdAsc(lot.getId()).stream()
                .filter(c -> lot.getLivreur() != null && c.getLivreur() != null && c.getLivreur().getId().equals(lot.getLivreur().getId()))
                .toList();
        return new LotVue(lot.getId(), lot.getStatut(), lot.getSource(), lot.getLivreur() == null ? null : lot.getLivreur().getPrenom(),
                lot.getAccepteLe(), lot.getDistanceKm(), lot.getDureeMinutes(), contenu.stream().map(Livraison::getId).toList(),
                etapes(lot, contenu));
    }

    /**
     * Arrets dans l'ordre de l'itineraire du lot. Le point de livraison n'est donne qu'une fois le colis collecte
     * (meme regle que MissionVue) ; avant, seule la zone du client est indiquee.
     */
    List<EtapeVue> etapes(Lot lot, List<Livraison> contenu) {
        Map<Long, Livraison> parId = new HashMap<>();
        contenu.forEach(c -> parId.put(c.getId(), c));
        List<Itineraire.Arret> arrets = new ArrayList<>(Itineraire.decoder(lot.getItineraire()));
        // Commandes absentes de l'itineraire (ancien lot) : collecte puis livraison a la suite
        for (Livraison c : contenu)
            if (arrets.stream().noneMatch(a -> a.commandeId().equals(c.getId()))) {
                arrets.add(new Itineraire.Arret(Itineraire.TypeEtape.COLLECTE, c.getId()));
                arrets.add(new Itineraire.Arret(Itineraire.TypeEtape.LIVRAISON, c.getId()));
            }
        double vitesse = contenu.stream().mapToDouble(c -> EstimationLivraisonService.vitesse(c.getPartenaire())).min()
                .orElse(Zone.VITESSE_PAR_DEFAUT_KMH);
        List<EtapeVue> etapes = new ArrayList<>();
        Point precedent = null;
        Duration ecoule = Duration.ZERO;
        for (Itineraire.Arret a : arrets) {
            Livraison c = parId.get(a.commandeId());
            if (c == null || !localisee(c)) continue;
            boolean collecte = a.type() == Itineraire.TypeEtape.COLLECTE;
            Point point = collecte ? commerce(c) : client(c);
            if (precedent != null) ecoule = ecoule.plus(Itineraire.trajet(precedent, point, vitesse));
            boolean adresseVisible = collecte || c.getRecupereeLe() != null;
            etapes.add(new EtapeVue(etapes.size() + 1, c.getId(), c.getCodeSuivi(), collecte ? "COLLECTE" : "LIVRAISON",
                    collecte ? Objects.toString(c.getPartenaire().getNomCommerce(), "Commerce") + " — " + Objects.toString(c.getPartenaire().getAdresse(), "")
                            : c.getClient().getPrenom() + (adresseVisible ? " — " + c.getAdresse() : " — zone " + c.getNomZone()),
                    adresseVisible ? point.latitude() : null, adresseVisible ? point.longitude() : null,
                    minutesArrondies(ecoule)));
            ecoule = ecoule.plus(Itineraire.TEMPS_ARRET);
            precedent = point;
        }
        return etapes;
    }

    private CommandeAttenteVue attenteVue(Livraison c, Instant maintenant) {
        long attente = c.getPreteLe() == null ? 0 : Math.max(0, Duration.between(c.getPreteLe(), maintenant).toMinutes());
        Lot lot = c.getLot() != null && c.getLot().getStatut() == StatutLot.PROPOSE ? c.getLot() : null;
        OffreEnCoursVue offre = lot == null ? null : offres.findAllByLotIdAndStatut(lot.getId(), StatutOffre.EN_ATTENTE).stream()
                .findFirst().map(o -> new OffreEnCoursVue(o.getId(), o.getLivreur().getPrenom(), o.getExpireLe(), o.isHorsZone())).orElse(null);
        return new CommandeAttenteVue(c.getId(), c.getCodeSuivi(), c.getPartenaire() == null ? c.getNomPartenaire() : c.getPartenaire().getNomCommerce(),
                c.getNomZone(), c.getPreteLe(), attente, attente >= parametres.delaiRechercheMaxMinutes(), lot == null ? null : lot.getId(), offre);
    }

    private static Point premiereCollecte(Lot lot, List<Livraison> contenu) {
        for (Itineraire.Arret a : Itineraire.decoder(lot.getItineraire()))
            if (a.type() == Itineraire.TypeEtape.COLLECTE)
                for (Livraison c : contenu) if (c.getId().equals(a.commandeId())) return commerce(c);
        return commerce(contenu.getFirst());
    }

    private static Point premiereCollecte(Itineraire.Resultat itineraire, List<Livraison> contenu) {
        if (itineraire != null)
            for (Itineraire.Etape e : itineraire.etapes()) if (e.type() == Itineraire.TypeEtape.COLLECTE) return e.point();
        return contenu.isEmpty() ? null : commerce(contenu.getFirst());
    }

    private OffreLot offreDuLivreur(Livreur livreur, Long offreId) {
        return offres.verrouiller(offreId).filter(o -> o.getLivreur().getId().equals(livreur.getId()))
                .orElseThrow(MarketplaceException::absent);
    }

    private Livreur livreur(String email) {
        return livreurs.findByEmail(email).orElseThrow(MarketplaceException::absent);
    }

    private long missions(Livreur l) {
        return commandes.countByLivreurIdAndStatutIn(l.getId(), AffectationMissionService.MISSIONS_EN_COURS);
    }

    static boolean localisee(Livraison c) {
        return c.getPartenaire() != null && c.getPartenaire().getLatitude() != null && c.getPartenaire().getLongitude() != null
                && c.getLatitude() != null && c.getLongitude() != null;
    }

    static Point commerce(Livraison c) { return new Point(c.getPartenaire().getLatitude(), c.getPartenaire().getLongitude()); }

    static Point client(Livraison c) { return new Point(c.getLatitude(), c.getLongitude()); }

    private static Instant maintenant() { return Instant.now().truncatedTo(ChronoUnit.MICROS); }

    private static double secondes(Instant debut, Instant fin) { return Duration.between(debut, fin).toMillis() / 1000.0; }

    static double arrondi(double valeur) { return Math.round(valeur * 1000) / 1000.0; }

    static int minutesArrondies(Duration d) { return (int) Math.ceil(d.toSeconds() / 60.0); }
}
