package com.fleetpulse.livraison.Dto;

import com.fleetpulse.livraison.Model.enums.DecisionEchec;
import com.fleetpulse.livraison.Model.enums.MotifEchec;
import java.time.Instant;

/** Contrats des echecs de livraison (US-308 coursier, US-312 responsable). */
public final class EchecDto {
    private EchecDto() { }

    /** US-308 : motif obligatoire ; commentaire obligatoire pour INCIDENT (au moins 5 caracteres). */
    public record EchecRequest(MotifEchec motif, String commentaire) { }

    /** US-312 : decision du responsable ; commentaire facultatif (300 caracteres max). */
    public record DecisionRequest(DecisionEchec decision, String commentaire) { }

    /** Vue responsable d'un echec : pas de coordonnees ni de telephone client. */
    public record EchecVue(Long id, String codeSuivi, String statut, String nomCommerce, String nomZone,
                           MotifEchec motif, String commentaire, Instant echecLe,
                           DecisionEchec decision, String commentaireDecision, Instant decisionLe) { }
}
