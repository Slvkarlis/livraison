package com.fleetpulse.livraison.Model.enums;

/**
 * US-803 : cycle de recrutement d'un commerce. INSCRIT et REFUSE sont les issues connues,
 * utilisees comme etiquettes d'entrainement du score (US-806).
 */
public enum StatutProspect {
    A_CONTACTER, CONTACTE, INTERESSE, INSCRIT, REFUSE;

    /** Transitions autorisees : avancer dans le cycle ou clore par un refus. */
    public boolean peutEvoluerVers(StatutProspect cible) {
        if (cible == REFUSE) return this != INSCRIT;
        return switch (this) {
            case A_CONTACTER -> cible == CONTACTE;
            case CONTACTE -> cible == INTERESSE || cible == INSCRIT;
            case INTERESSE -> cible == INSCRIT;
            default -> false;
        };
    }
}
