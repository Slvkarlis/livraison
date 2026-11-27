package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.QuartierDto.*;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.*;
import com.fleetpulse.livraison.Repository.*;
import com.fleetpulse.livraison.Service.EstimationArrivee.Point;
import java.math.*;
import java.time.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @Transactional
public class QuartierService {
    @Autowired private GroupeQuartierRepository groupes;
    @Autowired private PartenaireRepository partenaires;
    @Autowired private ClientRepository clients;
    @Autowired private LivraisonRepository commandes;
    @Autowired private LotRepository lots;
    @Autowired private CatalogueService catalogue;
    @Autowired private ZoneService zones;
    @Autowired private ParametresQuartier parametres;
    @Autowired private ParametresDispatch dispatch;
    @Autowired private ApplicationEventPublisher evenements;

    public record MembreActualise(String email, Long commandeId, StatutLivraison statut) { }
    public record GroupeChange(Long groupeId, List<MembreActualise> membres) {
        public GroupeChange(Long groupeId) { this(groupeId, List.of()); }
    }
    private void publier(GroupeQuartier g) {
        evenements.publishEvent(new GroupeChange(g.getId(), g.getCommandes().stream()
                .filter(c -> c.getClient() != null).map(c -> new MembreActualise(c.getClient().getEmail(), c.getId(), c.getStatut())).toList()));
    }

    /** Le commerce est verrouillé par CommandeService avant le devis et la création : pas de double groupe. */
    public Optional<GroupeQuartier> disponible(Partenaire p, Long zoneId, double lat, double lng, Instant maintenant) {
        if (!p.isGroupesQuartierActifs() || !dispatch.parLots()) return Optional.empty();
        return groupes.findAllByCommerceIdAndStatutOrderByOuvertureAsc(p.getId(), StatutGroupeQuartier.OUVERT).stream()
                .filter(g -> compatible(g, p.getId(), zoneId, lat, lng, maintenant)).findFirst();
    }

    public static boolean compatible(GroupeQuartier g, Long commerceId, Long zoneId, double lat, double lng, Instant maintenant) {
        return g.getStatut() == StatutGroupeQuartier.OUVERT && maintenant.isBefore(g.getExpiration())
                && g.getCommandes().size() < RegroupementLots.TAILLE_MAX
                && Objects.equals(g.getCommerce().getId(), commerceId) && Objects.equals(g.getZone().getId(), zoneId)
                && Distances.km(g.getLatitude(), g.getLongitude(), lat, lng) * 1000 <= g.getRayonMetres();
    }

    public BigDecimal prixAdhesion(GroupeQuartier g, BigDecimal normal) {
        return TarificationQuartier.frais(normal, null, g.getCommandes().size() + 1, true, g.getReductionDeux(), g.getReductionTrois());
    }

    public void inscrire(Livraison c, Long groupeAnnonce, BigDecimal normal, BigDecimal annonce, Instant maintenant) {
        Partenaire p = c.getPartenaire();
        if (!p.isGroupesQuartierActifs() || !dispatch.parLots() || !DispatchService.localisee(c)) return;
        var reglages = parametres.vue();
        c.setFraisNormauxQuartier(normal); c.setFraisAnnoncesQuartier(annonce);
        if (c.getPromesseLivraison() == null) {
            c.setPromesseLivraison(maintenant.plusSeconds(reglages.promesseMinutes() * 60L)); c.setSourcePromesse("REGLES");
        }
        GroupeQuartier g = groupeAnnonce == null ? null : groupes.verrouiller(groupeAnnonce).orElseThrow(MarketplaceException::absent);
        if (g != null && !compatible(g, p.getId(), p.getZone().getId(), c.getLatitude(), c.getLongitude(), maintenant))
            throw MarketplaceException.conflit("Le groupe a fermé. Vérifiez le nouveau devis.");
        if (g == null) {
            Instant expiration = maintenant.plusSeconds(reglages.fenetreSecondes());
            if (!ouverturePossible(c, expiration, reglages.preparationMinutes())) return;
            g = new GroupeQuartier(); g.setCommerce(p); g.setZone(p.getZone());
            g.setLatitude(c.getLatitude()); g.setLongitude(c.getLongitude()); g.setRayonMetres(reglages.rayonMetres());
            g.setOuverture(maintenant); g.setExpiration(expiration);
            g.setReductionDeux(reglages.reductionDeux()); g.setReductionTrois(reglages.reductionTrois());
            groupes.save(g);
        }
        c.setGroupeQuartier(g); g.getCommandes().add(c);
        recalculer(g);
        if (g.getCommandes().size() == RegroupementLots.TAILLE_MAX) {
            g.setStatut(StatutGroupeQuartier.COMPLET); fermer(g, maintenant);
        } else publier(g);
    }

    public static boolean ouverturePossible(Livraison c, Instant expiration, int preparationMinutes) {
        if (c.getPromesseLivraison() == null || !DispatchService.localisee(c)) return false;
        Instant prete = c.heurePretePrevue();
        if (prete == null) prete = c.getDateCreation().plusSeconds(preparationMinutes * 60L);
        // Borne prudente : préparation + fenêtre + approche et livraison (arrêts compris).
        Duration trajet = Itineraire.trajet(DispatchService.commerce(c), DispatchService.client(c), EstimationLivraisonService.vitesse(c.getPartenaire()));
        long attente = Math.max(0, Duration.between(c.getDateCreation(), expiration).toSeconds());
        return !prete.plusSeconds(attente).plus(EstimationLivraisonService.APPROCHE_COURSIER)
                .plus(Itineraire.TEMPS_ARRET.multipliedBy(2)).plus(trajet).isAfter(c.getPromesseLivraison());
    }

    /** Remises immédiatement acquises : même une annulation ultérieure ne peut les retirer. */
    void recalculer(GroupeQuartier g) {
        List<Livraison> membres = g.getCommandes();
        for (int i = 0; i < membres.size(); i++) {
            Livraison c = membres.get(i);
            BigDecimal frais = TarificationQuartier.frais(c.getFraisNormauxQuartier(), c.getFraisAnnoncesQuartier(), membres.size(),
                    i == membres.size() - 1, g.getReductionDeux(), g.getReductionTrois());
            c.setFraisAnnoncesQuartier(frais);
            appliquer(c, frais);
        }
    }

    private static void appliquer(Livraison c, BigDecimal frais) {
        c.setFraisFinauxQuartier(frais); c.setFraisLivraison(frais.doubleValue());
        c.setTotal(c.getMontantArticles().add(frais).setScale(3, RoundingMode.HALF_UP));
        c.setMontantACollecter(c.getModePaiement() == ModePaiement.COD ? c.getTotal().doubleValue() : 0);
    }

    public int fermerExpires(Instant maintenant) {
        int nb = 0;
        for (GroupeQuartier candidat : groupes.findAllByStatutOrderByOuvertureAsc(StatutGroupeQuartier.OUVERT)) {
            if (maintenant.isBefore(candidat.getExpiration())) continue;
            partenaires.verrouiller(candidat.getCommerce().getId()).orElseThrow();
            GroupeQuartier g = groupes.verrouiller(candidat.getId()).orElseThrow();
            if (g.getStatut() == StatutGroupeQuartier.OUVERT) { fermer(g, maintenant); nb++; }
        }
        return nb;
    }

    void fermer(GroupeQuartier g, Instant maintenant) {
        // Les membres sont verrouillés dans l'ordre de leur création.
        List<Livraison> membres = new ArrayList<>(g.getCommandes());
        for (Livraison c : membres) commandes.verrouiller(c.getId()).orElseThrow();
        g.setStatut(StatutGroupeQuartier.FERME); g.setFermeture(maintenant);
        while (membres.size() > 1) {
            Instant depart = departPrevu(membres, maintenant);
            var tournee = optimiser(membres, null, depart);
            if (tournee.isPresent()) break;
            // Retirer la promesse la plus serrée et recalculer la tournée des autres.
            Livraison fautive = membres.stream().min(Comparator.comparing(Livraison::getPromesseLivraison,
                    Comparator.nullsLast(Comparator.naturalOrder()))).orElseThrow();
            retirer(g, fautive); membres.remove(fautive);
        }
        recalculer(g);
        if (membres.size() <= 1) {
            for (Livraison c : membres) { c.setQuartierSeule(true); c.setVoisinsQuartier(0); }
        } else {
            Itineraire.Resultat r = optimiser(membres, null, departPrevu(membres, maintenant)).orElseThrow();
            Lot lot = new Lot(); lot.setSource("QUARTIER"); lot.setCreeLe(maintenant);
            lot.setItineraire(r.code()); lot.setDistanceKm(r.distanceKm()); lot.setDureeMinutes(DispatchService.minutesArrondies(r.duree()));
            lots.save(lot); g.setLot(lot);
            for (Livraison c : membres) { c.setLot(lot); c.setVoisinsQuartier(membres.size() - 1); }
            double separes = membres.stream().mapToDouble(c -> Itineraire.km(DispatchService.commerce(c), DispatchService.client(c))).sum();
            g.setGainKm(Math.max(0, separes - r.distanceKm()));
            g.setGainDt(BigDecimal.valueOf(g.getGainKm()).multiply(parametres.vue().coutKm()).setScale(3, RoundingMode.HALF_UP));
        }
        publier(g);
    }

    private Instant departPrevu(List<Livraison> membres, Instant maintenant) {
        Instant prete = membres.stream().map(c -> c.getPreteLe() != null ? c.getPreteLe()
                : c.heurePretePrevue() != null ? c.heurePretePrevue()
                : c.getDateCreation().plusSeconds(parametres.vue().preparationMinutes() * 60L)).max(Instant::compareTo).orElse(maintenant);
        return (prete.isAfter(maintenant) ? prete : maintenant).plus(EstimationLivraisonService.APPROCHE_COURSIER);
    }

    static Optional<Itineraire.Resultat> optimiser(List<Livraison> membres, Point position, Instant depart) {
        Map<Long, Instant> promesses = new HashMap<>();
        membres.forEach(c -> { if (c.getPromesseLivraison() != null) promesses.put(c.getId(), c.getPromesseLivraison()); });
        return Itineraire.optimiser(position, membres.stream().map(c -> new Itineraire.Course(c.getId(),
                DispatchService.commerce(c), DispatchService.client(c))).toList(),
                EstimationLivraisonService.vitesse(membres.getFirst().getPartenaire()), Duration.ofMinutes(35), depart, promesses);
    }

    /** Nouvelle vérification à la proposition et à l'acceptation : le temps d'attente du coursier a pu changer. */
    public void securiserLot(Lot lot, Point position, Instant depart) {
        List<Livraison> membres = new ArrayList<>(commandes.findAllByLotIdOrderByIdAsc(lot.getId()).stream()
                .filter(c -> c.getStatut() == StatutLivraison.PRETE && c.getLivreur() == null).toList());
        while (membres.size() > 1 && optimiser(membres, position, depart).isEmpty()) {
            Livraison fautive = membres.stream().min(Comparator.comparing(Livraison::getPromesseLivraison,
                    Comparator.nullsLast(Comparator.naturalOrder()))).orElseThrow();
            GroupeQuartier g = groupes.verrouiller(fautive.getGroupeQuartier().getId()).orElseThrow();
            retirer(g, fautive); membres.remove(fautive); recalculer(g);
            g.setGainKm(0); g.setGainDt(BigDecimal.ZERO.setScale(3));
            membres.forEach(c -> c.setVoisinsQuartier(membres.size() - 1));
            publier(g);
        }
    }

    private void retirer(GroupeQuartier g, Livraison c) {
        g.getCommandes().remove(c); c.setGroupeQuartier(null); c.setLot(null); c.setQuartierSeule(true); c.setVoisinsQuartier(0);
    }

    /** Écoute synchrone : annulation, refus et expiration sortent le membre dans la même transaction. */
    @EventListener
    public void surStatut(CommandeStatutChange e) {
        if (!Set.of(StatutLivraison.ANNULEE, StatutLivraison.REFUSEE).contains(e.nouveau())) return;
        Livraison c = commandes.findById(e.commandeId()).orElse(null);
        if (c == null || c.getGroupeQuartier() == null) return;
        GroupeQuartier g = groupes.verrouiller(c.getGroupeQuartier().getId()).orElseThrow();
        retirer(g, c);
        if (g.getCommandes().isEmpty()) g.setStatut(StatutGroupeQuartier.ANNULE);
        recalculer(g);
        if (g.getLot() != null) {
            List<Livraison> restants = g.getCommandes();
            if (!restants.isEmpty()) optimiser(restants, null, departPrevu(restants, Instant.now())).ifPresent(r -> {
                g.getLot().setItineraire(r.code()); g.getLot().setDistanceKm(r.distanceKm());
                g.getLot().setDureeMinutes(DispatchService.minutesArrondies(r.duree()));
            });
            restants.forEach(x -> x.setVoisinsQuartier(Math.max(0, restants.size() - 1)));
            g.setGainKm(0); g.setGainDt(BigDecimal.ZERO.setScale(3));
        }
        publier(g);
    }

    @Transactional(readOnly = true)
    public List<GroupeProche> proches(String email, Long adresseId) {
        AdresseLivraison a = catalogue.adresse(email, adresseId);
        Zone z = zones.desservie(a.getLatitude(), a.getLongitude()); Instant maintenant = Instant.now();
        return groupes.findAllByStatutOrderByOuvertureAsc(StatutGroupeQuartier.OUVERT).stream()
                .filter(g -> g.getCommerce().isActif() && g.getCommerce().isGroupesQuartierActifs() && g.getCommerce().accepteCommandes(maintenant))
                .filter(g -> compatible(g, g.getCommerce().getId(), z.getId(), a.getLatitude(), a.getLongitude(), maintenant))
                .map(g -> new GroupeProche(g.getId(), g.getCommerce().getId(), g.getCommerce().getNomCommerce(), g.getCommandes().size(),
                        g.getCommandes().size() == 2 ? BigDecimal.ONE : g.getReductionDeux(), prixAdhesion(g, z.getFraisLivraison()),
                        g.getExpiration(), Math.max(0, Duration.between(maintenant, g.getExpiration()).toSeconds()))).toList();
    }

    public Preference preference(String email) {
        return new Preference(clients.verrouiller(email).orElseThrow(MarketplaceException::absent).invitationsQuartierActives());
    }
    public Preference preference(String email, Preference r) {
        if (r == null) throw new MarketplaceException(400, "PREFERENCE_QUARTIER", "Indiquez votre préférence.");
        clients.verrouiller(email).orElseThrow(MarketplaceException::absent).setRecevoirInvitationsQuartier(r.recevoirInvitationsQuartier()); return r;
    }
    public Commerce activer(Long id, Activation r) {
        if (r == null) throw new MarketplaceException(400, "ACTIVATION_QUARTIER", "Indiquez l'activation.");
        Partenaire p = partenaires.verrouiller(id).orElseThrow(MarketplaceException::absent);
        p.setGroupesQuartierActifs(r.groupesQuartierActifs()); return new Commerce(p.getId(), p.getNomCommerce(), p.isGroupesQuartierActifs());
    }
    @Transactional(readOnly = true)
    public List<Commerce> commerces() { return partenaires.findAll().stream().map(p -> new Commerce(p.getId(), p.getNomCommerce(), p.isGroupesQuartierActifs())).toList(); }
    @Transactional(readOnly = true)
    public List<GroupeAdmin> lister() {
        return groupes.findAll(org.springframework.data.domain.Sort.by("id").descending()).stream().limit(500)
                .map(g -> new GroupeAdmin(g.getId(), g.getCommerce().getId(), g.getCommerce().getNomCommerce(), g.getStatut(), g.getCommandes().size(),
                        g.getLatitude(), g.getLongitude(), g.getRayonMetres(), g.getOuverture(), g.getExpiration(),
                        g.getLot() == null ? null : g.getLot().getId(), g.getGainKm(), g.getGainDt())).toList();
    }
    @Transactional(readOnly = true)
    public Statistiques statistiques() {
        List<GroupeQuartier> tous = groupes.findAll();
        List<GroupeQuartier> fermes = tous.stream().filter(g -> g.getStatut() == StatutGroupeQuartier.FERME).toList();
        return new Statistiques(tous.stream().filter(g -> g.getStatut() == StatutGroupeQuartier.OUVERT).count(), fermes.size(),
                tous.stream().filter(g -> g.getStatut() == StatutGroupeQuartier.ANNULE).count(),
                fermes.isEmpty() ? 0 : fermes.stream().mapToInt(g -> g.getCommandes().size()).sum() * 100.0 / (fermes.size() * RegroupementLots.TAILLE_MAX),
                fermes.stream().mapToDouble(GroupeQuartier::getGainKm).sum(), fermes.stream().map(GroupeQuartier::getGainDt).reduce(BigDecimal.ZERO, BigDecimal::add));
    }
}
