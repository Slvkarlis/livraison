package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.FinanceDto.*;
import com.fleetpulse.livraison.Model.Partenaire;
import com.fleetpulse.livraison.Model.TauxCommission;
import com.fleetpulse.livraison.Model.enums.ActionAudit;
import com.fleetpulse.livraison.Model.enums.PorteeCommission;
import com.fleetpulse.livraison.Repository.PartenaireRepository;
import com.fleetpulse.livraison.Repository.TauxCommissionRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Locale;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * US-502 : taux de commission configurables ; le plus specifique l'emporte :
 * taux du partenaire, sinon taux de sa categorie, sinon taux global, sinon 12 % (US-501).
 * Un changement de taux ne touche jamais une commande deja livree : son taux est fige dans FinanceCommande.
 */
@Service @RequiredArgsConstructor @Transactional
public class CommissionService {
    private final TauxCommissionRepository taux;
    private final PartenaireRepository partenaires;
    private final AuditService audit;

    @Transactional(readOnly = true)
    public BigDecimal tauxApplicable(Partenaire p) {
        if (p != null && p.getId() != null) {
            Optional<TauxCommission> propre = taux.findFirstByPorteeAndPartenaireId(PorteeCommission.PARTENAIRE, p.getId());
            if (propre.isPresent()) return propre.get().getTaux();
        }
        String categorie = p == null ? null : categorie(p.getCategorie());
        if (categorie != null) {
            Optional<TauxCommission> parCategorie = taux.findFirstByPorteeAndCategorie(PorteeCommission.CATEGORIE, categorie);
            if (parCategorie.isPresent()) return parCategorie.get().getTaux();
        }
        return tauxGlobal();
    }

    @Transactional(readOnly = true)
    public CommissionsVue lister() {
        return new CommissionsVue(tauxGlobal(), taux.findAllByOrderByPorteeAscIdAsc().stream().map(TauxVue::from).toList());
    }

    /** Cree ou remplace le taux de la portee et de la cible donnees. */
    public TauxVue definir(String email, TauxRequest r) {
        if (r == null || r.portee() == null) throw new IllegalArgumentException("Choisissez la portée du taux.");
        BigDecimal valeur = CalculsFinanciers.taux(r.taux());
        TauxCommission t = switch (r.portee()) {
            case GLOBAL -> taux.findFirstByPortee(PorteeCommission.GLOBAL).orElseGet(TauxCommission::new);
            case CATEGORIE -> {
                String categorie = categorie(r.categorie());
                if (categorie == null) throw new IllegalArgumentException("Indiquez la catégorie de commerce.");
                TauxCommission existant = taux.findFirstByPorteeAndCategorie(PorteeCommission.CATEGORIE, categorie).orElseGet(TauxCommission::new);
                existant.setCategorie(categorie);
                yield existant;
            }
            case PARTENAIRE -> {
                if (r.partenaireId() == null) throw new IllegalArgumentException("Choisissez le partenaire.");
                Partenaire p = partenaires.findById(r.partenaireId()).orElseThrow(MarketplaceException::absent);
                TauxCommission existant = taux.findFirstByPorteeAndPartenaireId(PorteeCommission.PARTENAIRE, p.getId()).orElseGet(TauxCommission::new);
                existant.setPartenaire(p);
                yield existant;
            }
        };
        BigDecimal ancien = t.getTaux();
        t.setPortee(r.portee());
        t.setTaux(valeur);
        t.setModifieLe(Instant.now().truncatedTo(ChronoUnit.MICROS));
        t.setModifiePar(email);
        taux.save(t);
        audit.enregistrer(ActionAudit.COMMISSION_MODIFIEE, "COMMISSION", t.getId(),
                cible(t) + " : " + (ancien == null ? "" : ancien.toPlainString() + " % → ") + valeur.toPlainString() + " %");
        return TauxVue.from(t);
    }

    public void supprimer(Long id) {
        TauxCommission t = taux.findById(id).orElseThrow(MarketplaceException::absent);
        audit.enregistrer(ActionAudit.COMMISSION_SUPPRIMEE, "COMMISSION", id, cible(t) + " : " + t.getTaux().toPlainString() + " %");
        taux.delete(t);
    }

    private BigDecimal tauxGlobal() {
        return taux.findFirstByPortee(PorteeCommission.GLOBAL).map(TauxCommission::getTaux).orElse(CalculsFinanciers.TAUX_PAR_DEFAUT);
    }

    /** Categories comparees sans tenir compte de la casse ni des espaces (« Restaurant » = « restaurant »). */
    static String categorie(String saisie) {
        if (saisie == null || saisie.isBlank()) return null;
        String c = saisie.trim().toLowerCase(Locale.ROOT);
        if (c.length() > 60) throw new IllegalArgumentException("Catégorie : 60 caractères maximum.");
        return c;
    }

    private static String cible(TauxCommission t) {
        return switch (t.getPortee()) {
            case GLOBAL -> "Taux global";
            case CATEGORIE -> "Catégorie " + t.getCategorie();
            case PARTENAIRE -> "Partenaire " + (t.getPartenaire() == null ? "?" : t.getPartenaire().getNomCommerce());
        };
    }
}
