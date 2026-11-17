package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.FinanceDto.*;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.ModePaiement;
import com.fleetpulse.livraison.Model.enums.StatutLivraison;
import com.fleetpulse.livraison.Model.enums.TypeEcriture;
import com.fleetpulse.livraison.Repository.EcritureLedgerRepository;
import com.fleetpulse.livraison.Repository.FinanceCommandeRepository;
import com.fleetpulse.livraison.Repository.LivraisonRepository;
import jakarta.persistence.criteria.Predicate;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * US-501 / US-503 : comptabilisation d'une commande a sa livraison.
 *
 * <p>Dans la meme transaction que la remise (ecouteur synchrone) : la commande livree et ses ecritures sont validees
 * ensemble, ou pas du tout. Idempotent : une commande n'est comptabilisee qu'une fois (FinanceCommande unique par commande).
 * Ecritures : GMV, commission, net partenaire, frais de livraison, cash detenu par le coursier, sa remuneration,
 * et l'ecart d'encaissement s'il y en a un.
 */
@Service @RequiredArgsConstructor @Transactional
public class ComptabiliteService {
    static final int LIMITE_MAX = 1000;

    private final FinanceCommandeRepository finances;
    private final EcritureLedgerRepository ledger;
    private final LivraisonRepository commandes;
    private final CommissionService commissions;
    private final BaremeService baremes;

    @EventListener
    public void surChangementDeStatut(CommandeStatutChange e) {
        if (e.nouveau() == StatutLivraison.LIVREE && e.ancien() != StatutLivraison.LIVREE)
            commandes.findById(e.commandeId()).ifPresent(this::comptabiliser);
    }

    public FinanceCommande comptabiliser(Livraison c) {
        var existante = finances.findByCommandeId(c.getId());
        if (existante.isPresent()) return existante.get();   // rejeu : jamais deux fois les memes ecritures

        Partenaire p = c.getPartenaire();
        Livreur livreur = c.getLivreur();
        BigDecimal frais = CalculsFinanciers.argent(BigDecimal.valueOf(c.getFraisLivraison()));
        BigDecimal articles = c.getMontantArticles() != null ? CalculsFinanciers.argent(c.getMontantArticles())
                : CalculsFinanciers.argent(RemiseLivreurService.montantAttendu(c).subtract(frais).max(BigDecimal.ZERO));
        BigDecimal taux = commissions.tauxApplicable(p);
        BigDecimal commission = CalculsFinanciers.commission(articles, taux);
        BigDecimal encaisse = c.getMontantEncaisse() != null ? CalculsFinanciers.argent(c.getMontantEncaisse())
                : c.getModePaiement() == ModePaiement.COD ? RemiseLivreurService.montantAttendu(c) : BigDecimal.ZERO.setScale(3);
        double km = p != null && p.getLatitude() != null && p.getLongitude() != null
                ? CalculsFinanciers.distanceMission(p.getLatitude(), p.getLongitude(), c.getLatitude(), c.getLongitude()) : 0;
        Long zoneId = p == null || p.getZone() == null ? null : p.getZone().getId();
        Instant maintenant = Instant.now().truncatedTo(ChronoUnit.MICROS);

        FinanceCommande f = new FinanceCommande();
        f.setCommande(c);
        f.setPartenaire(p);
        f.setLivreur(livreur);
        f.setZoneId(zoneId);
        f.setMontantArticles(articles);
        f.setTauxCommission(taux);
        f.setCommission(commission);
        f.setNetPartenaire(CalculsFinanciers.net(articles, commission));
        f.setFraisLivraison(frais);
        f.setMontantEncaisse(livreur == null ? BigDecimal.ZERO.setScale(3) : encaisse);
        f.setEcartEncaissement(CalculsFinanciers.argent(c.getEcartEncaissement()));
        f.setRemunerationCoursier(livreur == null ? BigDecimal.ZERO.setScale(3) : baremes.remuneration(zoneId, km));
        f.setDistanceKm(km);
        f.setLivreeLe(c.getLivreeLe() != null ? c.getLivreeLe() : maintenant);
        f.setComptabiliseLe(maintenant);
        finances.save(f);

        Long partenaireId = p == null ? null : p.getId();
        Long livreurId = livreur == null ? null : livreur.getId();
        String ref = c.getCodeSuivi();
        ecrire(TypeEcriture.GMV, articles, c, partenaireId, null, ref + " : articles vendus", maintenant);
        ecrire(TypeEcriture.COMMISSION, commission, c, partenaireId, null, ref + " : commission " + taux.toPlainString() + " %", maintenant);
        ecrire(TypeEcriture.NET_PARTENAIRE, f.getNetPartenaire(), c, partenaireId, null, ref + " : net dû au commerce", maintenant);
        ecrire(TypeEcriture.FRAIS_LIVRAISON, frais, c, partenaireId, null, ref + " : frais de livraison", maintenant);
        if (livreur != null) {
            ecrire(TypeEcriture.CASH_COURSIER, f.getMontantEncaisse(), c, partenaireId, livreurId, ref + " : espèces encaissées par le livreur", maintenant);
            ecrire(TypeEcriture.REMUNERATION_COURSIER, f.getRemunerationCoursier(), c, null, livreurId,
                    ref + " : mission de " + km + " km", maintenant);
        }
        if (f.getEcartEncaissement().signum() != 0)
            ecrire(TypeEcriture.ECART_ENCAISSEMENT, f.getEcartEncaissement().abs(), c, partenaireId, livreurId,
                    ref + (f.getEcartEncaissement().signum() < 0 ? " : manque à l'encaissement" : " : surplus encaissé")
                            + (c.getMotifEcart() == null ? "" : " (" + c.getMotifEcart() + ")"), maintenant);
        return f;
    }

    /** Ecriture immuable ; le ledger n'est jamais corrige, seulement complete. */
    public void ecrire(TypeEcriture type, BigDecimal montant, Long commandeId, Long partenaireId, Long livreurId, Long depotId,
                       Long closingId, String libelle, Instant date) {
        ledger.save(new EcritureLedger(type, CalculsFinanciers.argent(montant), commandeId, partenaireId, livreurId, depotId, closingId,
                libelle == null || libelle.length() <= 300 ? libelle : libelle.substring(0, 300), date));
    }

    private void ecrire(TypeEcriture type, BigDecimal montant, Livraison c, Long partenaireId, Long livreurId, String libelle, Instant date) {
        ecrire(type, montant, c.getId(), partenaireId, livreurId, null, null, libelle, date);
    }

    @Transactional(readOnly = true)
    public List<EcritureVue> ecritures(Long commandeId, Long partenaireId, Long livreurId, TypeEcriture type, Instant depuis, Integer limite) {
        Specification<EcritureLedger> filtre = (root, query, cb) -> {
            List<Predicate> p = new ArrayList<>();
            if (commandeId != null) p.add(cb.equal(root.get("commandeId"), commandeId));
            if (partenaireId != null) p.add(cb.equal(root.get("partenaireId"), partenaireId));
            if (livreurId != null) p.add(cb.equal(root.get("livreurId"), livreurId));
            if (type != null) p.add(cb.equal(root.get("type"), type));
            if (depuis != null) p.add(cb.greaterThanOrEqualTo(root.get("date"), depuis));
            return cb.and(p.toArray(Predicate[]::new));
        };
        int taille = limite == null || limite < 1 ? 200 : Math.min(limite, LIMITE_MAX);
        return ledger.findAll(filtre, PageRequest.of(0, taille, Sort.by(Sort.Direction.DESC, "id"))).stream().map(EcritureVue::from).toList();
    }

    @Transactional(readOnly = true)
    public FinanceCommandeVue detail(Long commandeId) {
        FinanceCommande f = finances.findByCommandeId(commandeId).orElseThrow(MarketplaceException::absent);
        Livraison c = f.getCommande();
        Livreur l = f.getLivreur();
        return new FinanceCommandeVue(c.getId(), c.getCodeSuivi(), f.getPartenaire() == null ? null : f.getPartenaire().getId(),
                f.getPartenaire() == null ? c.getNomPartenaire() : f.getPartenaire().getNomCommerce(),
                l == null ? null : l.getId(), l == null ? null : l.getPrenom() + " " + l.getNom(),
                f.getMontantArticles(), f.getTauxCommission(), f.getCommission(), f.getNetPartenaire(), f.getFraisLivraison(),
                f.getMontantEncaisse(), f.getEcartEncaissement(), f.getRemunerationCoursier(), f.getDistanceKm(), f.getLivreeLe(),
                f.getDepot() == null ? null : f.getDepot().getNumeroRecu(),
                f.getClosingPartenaire() == null ? null : f.getClosingPartenaire().getId(),
                f.getClosingCoursier() == null ? null : f.getClosingCoursier().getId(),
                ledger.findAllByCommandeIdOrderByIdAsc(commandeId).stream().map(EcritureVue::from).toList());
    }
}
