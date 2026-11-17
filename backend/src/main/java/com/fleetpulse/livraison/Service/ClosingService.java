package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.FinanceDto.*;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.ActionAudit;
import com.fleetpulse.livraison.Model.enums.TypeEcriture;
import com.fleetpulse.livraison.Repository.*;
import com.fleetpulse.livraison.Service.CalculsFinanciers.Semaine;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

/**
 * US-506 / US-512 : closing hebdomadaire.
 *
 * <ul>
 *   <li>Reversement d'un partenaire = net de ses commandes livrees avant la fin de la semaine, dont le cash est rapproche
 *       (depose, US-505) et pas encore reverse. Une commande dont le cash n'est pas depose attend un closing suivant.</li>
 *   <li>Releve d'un coursier = remuneration de ses missions livrees avant la fin de la semaine et pas encore payees.</li>
 * </ul>
 * Un seul closing par semaine, seulement une fois la semaine terminee. Les commandes sont marquees (jamais payees deux fois)
 * et chaque reversement ou paiement est ecrit au ledger, commande par commande.
 */
@Service @RequiredArgsConstructor @Transactional
public class ClosingService {
    private final FinanceCommandeRepository finances;
    private final ClosingRepository closings;
    private final ReleveReversementRepository relevesPartenaires;
    private final ReleveCoursierRepository relevesCoursiers;
    private final ComptabiliteService comptabilite;
    private final AuditService audit;

    /** Ce que donnerait le closing de la semaine (ou le closing deja valide de cette semaine). */
    @Transactional(readOnly = true)
    public ClosingVue apercu(LocalDate jour) {
        Semaine s = CalculsFinanciers.semaine(jour == null ? LocalDate.now(MessagesStatut.FUSEAU) : jour);
        Optional<Closing> existant = closings.findBySemaine(s.lundi());
        if (existant.isPresent()) return vue(existant.get());
        Calcul calcul = calculer(s);
        return new ClosingVue(null, s.lundi(), s.debut(), s.fin(), null, null, calcul.totalReversements(), calcul.totalRemunerations(),
                calcul.aReverser().size(), calcul.aPayer().size(), calcul.nonRapprochees().size(), CaisseService.solde(calcul.nonRapprochees()),
                calcul.partenaires(), calcul.coursiers());
    }

    @Transactional(isolation = Isolation.SERIALIZABLE)
    public ClosingVue valider(String email, ClosingRequest r) {
        if (r == null || r.semaine() == null) throw new IllegalArgumentException("Choisissez la semaine à clôturer.");
        Semaine s = CalculsFinanciers.semaine(r.semaine());
        Instant maintenant = Instant.now().truncatedTo(ChronoUnit.MICROS);
        if (s.fin().isAfter(maintenant))
            throw MarketplaceException.conflit("La semaine du " + s.lundi() + " n'est pas terminée : le closing se fait à partir du lundi suivant.");
        if (closings.findBySemaine(s.lundi()).isPresent()) throw MarketplaceException.conflit("Cette semaine est déjà clôturée.");

        Calcul calcul = calculer(s);
        Closing c = new Closing();
        c.setSemaine(s.lundi());
        c.setDebut(s.debut());
        c.setFin(s.fin());
        c.setValideLe(maintenant);
        c.setValidePar(email);
        c.setTotalReversements(calcul.totalReversements());
        c.setTotalRemunerations(calcul.totalRemunerations());
        c.setNbCommandesPartenaires(calcul.aReverser().size());
        c.setNbMissions(calcul.aPayer().size());
        closings.save(c);

        for (ReleveReversementVue v : calcul.partenaires()) {
            ReleveReversement releve = new ReleveReversement();
            releve.setClosing(c);
            releve.setPartenaire(calcul.partenairesParId().get(v.partenaireId()));
            releve.setNbCommandes(v.nbCommandes());
            releve.setVentes(v.ventes());
            releve.setCommission(v.commission());
            releve.setNet(v.net());
            relevesPartenaires.save(releve);
        }
        for (ReleveCoursierVue v : calcul.coursiers()) {
            ReleveCoursier releve = new ReleveCoursier();
            releve.setClosing(c);
            releve.setLivreur(calcul.livreursParId().get(v.livreurId()));
            releve.setNbMissions(v.nbMissions());
            releve.setDistanceKm(v.distanceKm());
            releve.setRemuneration(v.remuneration());
            relevesCoursiers.save(releve);
        }
        String reference = "Closing semaine du " + s.lundi();
        for (FinanceCommande f : calcul.aReverser()) {
            f.setClosingPartenaire(c);
            comptabilite.ecrire(TypeEcriture.REVERSEMENT_PARTENAIRE, f.getNetPartenaire(), f.getCommande().getId(), f.getPartenaire().getId(),
                    null, null, c.getId(), reference + " : " + f.getCommande().getCodeSuivi(), maintenant);
        }
        for (FinanceCommande f : calcul.aPayer()) {
            f.setClosingCoursier(c);
            comptabilite.ecrire(TypeEcriture.PAIEMENT_COURSIER, f.getRemunerationCoursier(), f.getCommande().getId(), null,
                    f.getLivreur().getId(), null, c.getId(), reference + " : mission " + f.getCommande().getCodeSuivi(), maintenant);
        }
        audit.enregistrer(ActionAudit.CLOSING_VALIDE, "CLOSING", c.getId(), reference + " : " + calcul.totalReversements().toPlainString()
                + " DT à reverser à " + calcul.partenaires().size() + " partenaire(s), " + calcul.totalRemunerations().toPlainString()
                + " DT à payer à " + calcul.coursiers().size() + " livreur(s)");
        return vue(c);
    }

    @Transactional(readOnly = true)
    public List<ClosingVue> lister() {
        return closings.findAllByOrderBySemaineDesc().stream().map(this::vue).toList();
    }

    @Transactional(readOnly = true)
    public ClosingVue detail(Long id) {
        return vue(closings.findById(id).orElseThrow(MarketplaceException::absent));
    }

    /** Commandes concernees par un closing et releves calcules, avant tout enregistrement. */
    record Calcul(List<FinanceCommande> aReverser, List<FinanceCommande> aPayer, List<FinanceCommande> nonRapprochees,
                  List<ReleveReversementVue> partenaires, List<ReleveCoursierVue> coursiers,
                  Map<Long, Partenaire> partenairesParId, Map<Long, Livreur> livreursParId) {
        BigDecimal totalReversements() { return partenaires.stream().map(ReleveReversementVue::net).reduce(BigDecimal.ZERO.setScale(3), BigDecimal::add); }
        BigDecimal totalRemunerations() { return coursiers.stream().map(ReleveCoursierVue::remuneration).reduce(BigDecimal.ZERO.setScale(3), BigDecimal::add); }
    }

    Calcul calculer(Semaine s) {
        List<FinanceCommande> aReverser = finances.findAllByDepotIsNotNullAndClosingPartenaireIsNullAndLivreeLeBeforeOrderByIdAsc(s.fin()).stream()
                .filter(f -> f.getPartenaire() != null).toList();
        List<FinanceCommande> aPayer = finances.findAllByClosingCoursierIsNullAndLivreurIsNotNullAndLivreeLeBeforeOrderByIdAsc(s.fin());
        List<FinanceCommande> nonRapprochees = finances.findAllByDepotIsNullAndLivreurIsNotNullOrderByLivreeLeAscIdAsc().stream()
                .filter(f -> f.getLivreeLe().isBefore(s.fin())).toList();

        Map<Long, Partenaire> partenairesParId = new LinkedHashMap<>();
        Map<Long, List<FinanceCommande>> parPartenaire = new LinkedHashMap<>();
        for (FinanceCommande f : aReverser) {
            partenairesParId.putIfAbsent(f.getPartenaire().getId(), f.getPartenaire());
            parPartenaire.computeIfAbsent(f.getPartenaire().getId(), k -> new ArrayList<>()).add(f);
        }
        List<ReleveReversementVue> partenaires = parPartenaire.entrySet().stream().map(e -> new ReleveReversementVue(e.getKey(),
                partenairesParId.get(e.getKey()).getNomCommerce(), e.getValue().size(),
                somme(e.getValue(), FinanceCommande::getMontantArticles), somme(e.getValue(), FinanceCommande::getCommission),
                somme(e.getValue(), FinanceCommande::getNetPartenaire))).toList();

        Map<Long, Livreur> livreursParId = new LinkedHashMap<>();
        Map<Long, List<FinanceCommande>> parLivreur = new LinkedHashMap<>();
        for (FinanceCommande f : aPayer) {
            livreursParId.putIfAbsent(f.getLivreur().getId(), f.getLivreur());
            parLivreur.computeIfAbsent(f.getLivreur().getId(), k -> new ArrayList<>()).add(f);
        }
        List<ReleveCoursierVue> coursiers = parLivreur.entrySet().stream().map(e -> {
            Livreur l = livreursParId.get(e.getKey());
            double km = Math.round(e.getValue().stream().mapToDouble(FinanceCommande::getDistanceKm).sum() * 1000) / 1000.0;
            return new ReleveCoursierVue(e.getKey(), l.getPrenom(), l.getNom(), e.getValue().size(), km,
                    somme(e.getValue(), FinanceCommande::getRemunerationCoursier));
        }).toList();
        return new Calcul(aReverser, aPayer, nonRapprochees, partenaires, coursiers, partenairesParId, livreursParId);
    }

    private ClosingVue vue(Closing c) {
        List<ReleveReversementVue> partenaires = relevesPartenaires.findAllByClosingIdOrderByIdAsc(c.getId()).stream()
                .map(r -> new ReleveReversementVue(r.getPartenaire().getId(), r.getPartenaire().getNomCommerce(), r.getNbCommandes(),
                        r.getVentes(), r.getCommission(), r.getNet())).toList();
        List<ReleveCoursierVue> coursiers = relevesCoursiers.findAllByClosingIdOrderByIdAsc(c.getId()).stream()
                .map(r -> new ReleveCoursierVue(r.getLivreur().getId(), r.getLivreur().getPrenom(), r.getLivreur().getNom(),
                        r.getNbMissions(), r.getDistanceKm(), r.getRemuneration())).toList();
        return new ClosingVue(c.getId(), c.getSemaine(), c.getDebut(), c.getFin(), c.getValideLe(), c.getValidePar(),
                c.getTotalReversements(), c.getTotalRemunerations(), c.getNbCommandesPartenaires(), c.getNbMissions(), 0,
                BigDecimal.ZERO.setScale(3), partenaires, coursiers);
    }

    private static BigDecimal somme(List<FinanceCommande> liste, java.util.function.Function<FinanceCommande, BigDecimal> montant) {
        return liste.stream().map(montant).reduce(BigDecimal.ZERO.setScale(3), BigDecimal::add);
    }
}
