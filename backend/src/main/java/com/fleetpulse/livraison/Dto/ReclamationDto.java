package com.fleetpulse.livraison.Dto;

import com.fleetpulse.livraison.Model.Reclamation;
import com.fleetpulse.livraison.Model.enums.ImputationLitige;
import com.fleetpulse.livraison.Model.enums.StatutReclamation;
import com.fleetpulse.livraison.Model.enums.TypeReclamation;
import java.math.BigDecimal;
import java.time.Instant;

/** Contrats des reclamations (US-516 client, US-517 finance). */
public final class ReclamationDto {
    private ReclamationDto() { }

    public record OuvertureRequest(Long commandeId, TypeReclamation type, String description, BigDecimal montantDemande) { }

    /** montantRembourse 0 = rejet (statut REJETEE, imputation absente). */
    public record DecisionRequest(BigDecimal montantRembourse, ImputationLitige imputation, String commentaire) { }

    public record ReclamationVue(Long id, Long commandeId, String codeSuivi, TypeReclamation type, String description,
                                 BigDecimal montantDemande, StatutReclamation statut, Instant creeeLe,
                                 BigDecimal montantRembourse, ImputationLitige imputation, String commentaireDecision, Instant decideeLe) {
        public static ReclamationVue from(Reclamation r) {
            return new ReclamationVue(r.getId(), r.getCommande().getId(), r.getCommande().getCodeSuivi(), r.getType(),
                    r.getDescription(), r.getMontantDemande(), r.getStatut(), r.getCreeeLe(),
                    r.getMontantRembourse(), r.getImputation(), r.getCommentaireDecision(), r.getDecideeLe());
        }
    }
}
