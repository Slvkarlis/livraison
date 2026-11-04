package com.fleetpulse.livraison.Model.enums;

/**
 * Cycle de vie d'une commande (transitions autorisees : CommandeWorkflow).
 * Sprint 2 bis : PENDING_PARTNER -> ACCEPTEE | REFUSEE | ANNULEE, ACCEPTEE -> EN_PREPARATION -> PRETE -> AFFECTEE -> RECUPEREE.
 * EN_COURS, A_PROXIMITE, ARRIVEE, LIVREE, ECHEC, RETOURNEE : Sprint 3 et suivants.
 */
public enum StatutLivraison {
    PENDING_PARTNER, ACCEPTEE, REFUSEE, EN_PREPARATION, PRETE, AFFECTEE, RECUPEREE, ANNULEE,
    EN_COURS, A_PROXIMITE, ARRIVEE, LIVREE, ECHEC, RETOURNEE
}
