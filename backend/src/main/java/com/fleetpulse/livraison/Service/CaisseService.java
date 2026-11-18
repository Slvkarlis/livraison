package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.FinanceDto.*;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.ActionAudit;
import com.fleetpulse.livraison.Model.enums.StatutDepot;
import com.fleetpulse.livraison.Model.enums.TypeEcriture;
import com.fleetpulse.livraison.Repository.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * US-504 / US-505 : cash detenu par les coursiers et depot integral au responsable FINANCE.
 *
 * <p>Solde d'un coursier = especes encaissees sur ses commandes livrees dont le cash n'est pas encore depose.
 * Un depot couvre tout le solde du moment : chaque commande est rattachee au recu (cash rapproche). Un montant recu
 * different du solde est accepte seulement avec un motif (manque ou surplus trace au ledger). Rejouer le meme depot
 * (meme cle) renvoie le meme recu.
 */
@Service @RequiredArgsConstructor @Transactional
public class CaisseService {
    static final int MOTIF_MIN = 5, MOTIF_MAX = 300;

    private final FinanceCommandeRepository finances;
    private final DepotCashRepository depots;
    private final LivreurRepository livreurs;
    private final ReleveCoursierRepository relevesCoursiers;
    private final ComptabiliteService comptabilite;
    private final AuditService audit;

    /** État actuel du cash pour la cohorte de livraisons choisie, agrégé en base. */
    @Transactional(readOnly = true)
    public BigDecimal soldeBi(PeriodeBi periode) {
        return CalculsFinanciers.argent(finances.soldeBi(periode.depuis(), periode.jusqua()));
    }

    /** Cash en circulation, par coursier, du plus gros solde au plus petit. */
    @Transactional(readOnly = true)
    public CaissesVue caisses() {
        Map<Long, List<FinanceCommande>> parLivreur = new LinkedHashMap<>();
        for (FinanceCommande f : finances.findAllByDepotIsNullAndLivreurIsNotNullOrderByLivreeLeAscIdAsc())
            parLivreur.computeIfAbsent(f.getLivreur().getId(), k -> new ArrayList<>()).add(f);
        List<SoldeCoursierVue> soldes = parLivreur.values().stream().map(liste -> {
            Livreur l = liste.getFirst().getLivreur();
            return new SoldeCoursierVue(l.getId(), l.getPrenom(), l.getNom(), solde(liste), liste.size(), liste.getFirst().getLivreeLe());
        }).sorted(Comparator.comparing(SoldeCoursierVue::solde).reversed().thenComparing(SoldeCoursierVue::livreurId)).toList();
        BigDecimal total = soldes.stream().map(SoldeCoursierVue::solde).reduce(BigDecimal.ZERO.setScale(3), BigDecimal::add);
        return new CaissesVue(total, soldes);
    }

    @Transactional(readOnly = true)
    public CaisseCoursierVue caisse(Long livreurId) {
        Livreur l = livreurs.findById(livreurId).orElseThrow(MarketplaceException::absent);
        List<FinanceCommande> enMain = finances.findAllByLivreurIdAndDepotIsNullOrderByLivreeLeAscIdAsc(livreurId);
        return new CaisseCoursierVue(l.getId(), l.getPrenom(), l.getNom(), solde(enMain),
                enMain.stream().map(CommandeEncaisseeVue::from).toList(), recus(livreurId, false));
    }

    /** US-504 : vue du coursier connecte (solde, commandes encaissees, recus, remuneration et releves hebdomadaires). */
    @Transactional(readOnly = true)
    public CaisseLivreurVue caisseDuLivreur(String email) {
        Livreur l = livreurs.findByEmail(email).orElseThrow(MarketplaceException::absent);
        List<FinanceCommande> enMain = finances.findAllByLivreurIdAndDepotIsNullOrderByLivreeLeAscIdAsc(l.getId());
        List<FinanceCommande> nonPayees = finances.findAllByLivreurIdAndClosingCoursierIsNullOrderByLivreeLeAscIdAsc(l.getId());
        BigDecimal enAttente = nonPayees.stream().map(FinanceCommande::getRemunerationCoursier)
                .reduce(BigDecimal.ZERO.setScale(3), BigDecimal::add);
        return new CaisseLivreurVue(solde(enMain), enMain.stream().map(CommandeEncaisseeVue::from).toList(), recus(l.getId(), false),
                nonPayees.size(), enAttente, relevesCoursiers.findAllByLivreurIdOrderByIdDesc(l.getId()).stream()
                .map(r -> new ReleveLivreurVue(r.getClosing().getId(), r.getClosing().getSemaine(), r.getNbMissions(), r.getDistanceKm(),
                        r.getRemuneration(), r.getClosing().getValideLe())).toList());
    }

    /** US-505 : depot integral du cash d'un coursier, recu et rapprochement des commandes. */
    public RecuVue deposer(String email, DepotRequest r) {
        if (r == null || r.livreurId() == null) throw new IllegalArgumentException("Choisissez le livreur.");
        BigDecimal recu = CalculsFinanciers.montantSaisi(r.montantRecu(), "Montant reçu");
        String cle = r.cleIdempotence() == null ? "" : r.cleIdempotence().trim();
        if (cle.length() < 8 || cle.length() > 80) throw new IllegalArgumentException("Clé d'idempotence invalide (8 à 80 caractères).");
        Optional<DepotCash> rejeu = depots.findByCleIdempotence(cle);
        if (rejeu.isPresent()) {
            DepotCash d = rejeu.get();
            if (!d.getLivreur().getId().equals(r.livreurId()) || d.getMontantRecu().compareTo(recu) != 0)
                throw MarketplaceException.conflit("Cette clé correspond à un autre dépôt.");
            return recuVue(d, true);
        }

        Livreur livreur = livreurs.verrouiller(r.livreurId()).orElseThrow(MarketplaceException::absent);
        List<FinanceCommande> enMain = finances.findAllByLivreurIdAndDepotIsNullOrderByLivreeLeAscIdAsc(livreur.getId());
        if (enMain.isEmpty()) throw MarketplaceException.conflit("Ce livreur ne détient aucun encaissement à déposer.");
        BigDecimal attendu = solde(enMain);
        BigDecimal ecart = recu.subtract(attendu);
        String motif = r.motifEcart() == null ? null : r.motifEcart().trim();
        if (ecart.signum() != 0 && (motif == null || motif.length() < MOTIF_MIN))
            throw new IllegalArgumentException("Le montant reçu (" + recu.toPlainString() + " DT) diffère du solde du livreur ("
                    + attendu.toPlainString() + " DT) : indiquez le motif de l'écart.");
        if (motif != null && motif.length() > MOTIF_MAX) throw new IllegalArgumentException("Motif : " + MOTIF_MAX + " caractères maximum.");

        Instant maintenant = Instant.now().truncatedTo(ChronoUnit.MICROS);
        DepotCash d = new DepotCash();
        d.setLivreur(livreur);
        d.setMontantAttendu(attendu);
        d.setMontantRecu(recu);
        d.setEcart(ecart);
        d.setMotifEcart(ecart.signum() == 0 ? null : motif);
        d.setStatut(ecart.signum() == 0 ? StatutDepot.RAPPROCHE : StatutDepot.ECART);
        d.setNbCommandes(enMain.size());
        d.setDate(maintenant);
        d.setEnregistrePar(email);
        d.setCleIdempotence(cle);
        depots.save(d);
        d.setNumeroRecu(CalculsFinanciers.numeroRecu(d.getId(), maintenant));

        for (FinanceCommande f : enMain) {
            f.setDepot(d);
            comptabilite.ecrire(TypeEcriture.DEPOT_CASH, f.getMontantEncaisse(), f.getCommande().getId(),
                    f.getPartenaire() == null ? null : f.getPartenaire().getId(), livreur.getId(), d.getId(), null,
                    d.getNumeroRecu() + " : cash de " + f.getCommande().getCodeSuivi() + " déposé", maintenant);
        }
        if (ecart.signum() != 0)
            comptabilite.ecrire(TypeEcriture.ECART_DEPOT, ecart.abs(), null, null, livreur.getId(), d.getId(), null,
                    d.getNumeroRecu() + (ecart.signum() < 0 ? " : manque au dépôt" : " : surplus au dépôt") + " (" + motif + ")", maintenant);
        audit.enregistrer(ActionAudit.DEPOT_CASH_ENREGISTRE, "LIVREUR", livreur.getId(), d.getNumeroRecu() + " : " + recu.toPlainString()
                + " DT reçus pour " + attendu.toPlainString() + " DT attendus (" + enMain.size() + " commande(s))");
        return recuVue(d, true);
    }

    @Transactional(readOnly = true)
    public List<RecuVue> recus(Long livreurId, boolean avecCommandes) {
        List<DepotCash> liste = livreurId == null ? depots.findTop100ByOrderByDateDescIdDesc() : depots.findAllByLivreurIdOrderByDateDescIdDesc(livreurId);
        return liste.stream().map(d -> recuVue(d, avecCommandes)).toList();
    }

    @Transactional(readOnly = true)
    public RecuVue recu(Long id) {
        return recuVue(depots.findById(id).orElseThrow(MarketplaceException::absent), true);
    }

    private RecuVue recuVue(DepotCash d, boolean avecCommandes) {
        Livreur l = d.getLivreur();
        return new RecuVue(d.getId(), d.getNumeroRecu(), l.getId(), l.getPrenom() + " " + l.getNom(), d.getMontantAttendu(), d.getMontantRecu(),
                d.getEcart(), d.getMotifEcart(), d.getStatut(), d.getNbCommandes(), d.getDate(), d.getEnregistrePar(),
                avecCommandes ? finances.findAllByDepotIdOrderByLivreeLeAscIdAsc(d.getId()).stream().map(CommandeEncaisseeVue::from).toList() : List.of());
    }

    static BigDecimal solde(List<FinanceCommande> commandes) {
        return commandes.stream().map(FinanceCommande::getMontantEncaisse).reduce(BigDecimal.ZERO.setScale(3), BigDecimal::add);
    }
}
