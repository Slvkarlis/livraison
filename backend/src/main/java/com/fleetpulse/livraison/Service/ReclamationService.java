package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.ReclamationDto.*;
import com.fleetpulse.livraison.Model.Livraison;
import com.fleetpulse.livraison.Model.Reclamation;
import com.fleetpulse.livraison.Model.enums.ActionAudit;
import com.fleetpulse.livraison.Model.enums.ImputationLitige;
import com.fleetpulse.livraison.Model.enums.StatutLivraison;
import com.fleetpulse.livraison.Model.enums.StatutReclamation;
import com.fleetpulse.livraison.Model.enums.TypeEcriture;
import com.fleetpulse.livraison.Repository.LivraisonRepository;
import com.fleetpulse.livraison.Repository.ReclamationRepository;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reclamations (Sprint 7).
 * US-516 : le client ouvre une reclamation sur sa commande livree, dans les 48 h, une seule fois.
 * US-517 : le responsable finance decide du remboursement et de son imputation ; la decision est inscrite au ledger.
 */
@Service @RequiredArgsConstructor @Transactional
public class ReclamationService {
    static final Duration DELAI = Duration.ofHours(48);
    static final int DESCRIPTION_MIN = 10;
    static final int DESCRIPTION_MAX = 500;

    private final LivraisonRepository commandes;
    private final ReclamationRepository reclamations;
    private final ComptabiliteService comptabilite;
    private final AuditService audit;

    public ReclamationVue ouvrir(String email, OuvertureRequest r) {
        if (r == null || r.commandeId() == null) throw new IllegalArgumentException("Indiquez la commande concernée.");
        Livraison c = commandes.findById(r.commandeId())
                .filter(x -> x.getClient().getEmail().equals(email))
                .orElseThrow(MarketplaceException::absent);
        if (c.getStatut() != StatutLivraison.LIVREE || c.getLivreeLe() == null)
            throw MarketplaceException.conflit("Une réclamation ne s'ouvre qu'après la livraison.");
        if (Instant.now().isAfter(c.getLivreeLe().plus(DELAI)))
            throw MarketplaceException.conflit("Le délai de réclamation de 48 h est dépassé.");
        if (reclamations.findByCommandeId(c.getId()).isPresent())
            throw MarketplaceException.conflit("Une réclamation existe déjà pour cette commande.");
        if (r.type() == null) throw new IllegalArgumentException("Choisissez le motif de la réclamation.");
        String description = r.description() == null ? "" : r.description().strip();
        if (description.length() < DESCRIPTION_MIN || description.length() > DESCRIPTION_MAX)
            throw new IllegalArgumentException("Décrivez le problème (entre 10 et 500 caractères).");
        BigDecimal demande = r.montantDemande();
        if (demande == null || demande.signum() <= 0 || demande.compareTo(c.getTotal()) > 0)
            throw new IllegalArgumentException("Le montant demandé doit être positif et ne pas dépasser le total de la commande.");

        Reclamation rec = reclamations.save(new Reclamation(c, r.type(), description, demande.setScale(3)));
        audit.enregistrer(ActionAudit.RECLAMATION_OUVERTE, "COMMANDE", c.getId(), c.getCodeSuivi() + " : " + r.type().name());
        return ReclamationVue.from(rec);
    }

    @Transactional(readOnly = true)
    public List<ReclamationVue> mesReclamations(String email) {
        return reclamations.findAllByCommandeClientEmailOrderByCreeeLeDesc(email).stream().map(ReclamationVue::from).toList();
    }

    @Transactional(readOnly = true)
    public List<ReclamationVue> aTraiter() {
        return reclamations.findAllByStatutOrderByCreeeLeAsc(StatutReclamation.OUVERTE).stream().map(ReclamationVue::from).toList();
    }

    /** US-517 : montant 0 rejette la demande ; sinon, imputation obligatoire et montant <= montant demande. */
    public ReclamationVue decider(String emailFinance, Long id, DecisionRequest r) {
        Reclamation rec = reclamations.findById(id).orElseThrow(MarketplaceException::absent);
        if (rec.getStatut() != StatutReclamation.OUVERTE)
            throw MarketplaceException.conflit("Cette réclamation est déjà traitée (" + rec.getStatut() + ").");
        if (r == null || r.montantRembourse() == null || r.montantRembourse().signum() < 0)
            throw new IllegalArgumentException("Indiquez le montant remboursé (0 pour rejeter).");
        String commentaire = r.commentaire() == null || r.commentaire().isBlank() ? null : r.commentaire().strip();
        if (commentaire != null && commentaire.length() > 300)
            throw new IllegalArgumentException("Commentaire trop long (300 caractères maximum).");

        BigDecimal montant = r.montantRembourse().setScale(3);
        Instant maintenant = Instant.now();
        Livraison c = rec.getCommande();
        if (montant.signum() == 0) {
            rec.decider(StatutReclamation.REJETEE, montant, null, commentaire, emailFinance, maintenant);
            audit.enregistrer(ActionAudit.RECLAMATION_TRAITEE, "COMMANDE", c.getId(), c.getCodeSuivi() + " : rejetée");
            return ReclamationVue.from(rec);
        }
        if (montant.compareTo(rec.getMontantDemande()) > 0)
            throw new IllegalArgumentException("Le remboursement ne peut pas dépasser le montant demandé.");
        if (r.imputation() == null) throw new IllegalArgumentException("Indiquez qui supporte le remboursement.");
        if (r.imputation() == ImputationLitige.COURSIER && c.getLivreur() == null)
            throw new IllegalArgumentException("Aucun coursier n'était affecté à cette commande : imputez au partenaire ou au responsable.");

        rec.decider(StatutReclamation.RESOLUE, montant, r.imputation(), commentaire, emailFinance, maintenant);
        String libelle = "Réclamation " + c.getCodeSuivi() + " : " + (commentaire == null ? "remboursement" : commentaire);
        comptabilite.ecrire(TypeEcriture.REMBOURSEMENT, montant, c.getId(), null, null, null, null, libelle, maintenant);
        if (r.imputation() == ImputationLitige.PARTENAIRE) {
            comptabilite.ecrire(TypeEcriture.COMPENSATION, montant, c.getId(), c.getPartenaire().getId(), null, null, null,
                    libelle + " (imputé au partenaire)", maintenant);
        } else if (r.imputation() == ImputationLitige.COURSIER) {
            comptabilite.ecrire(TypeEcriture.COMPENSATION, montant, c.getId(), null, c.getLivreur().getId(), null, null,
                    libelle + " (imputé au coursier)", maintenant);
        }
        audit.enregistrer(ActionAudit.RECLAMATION_TRAITEE, "COMMANDE", c.getId(), c.getCodeSuivi() + " : " + montant + " DT, " + r.imputation());
        return ReclamationVue.from(rec);
    }
}
