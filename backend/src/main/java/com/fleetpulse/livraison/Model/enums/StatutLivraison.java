package com.fleetpulse.livraison.Model.enums;

/**
 * Cycle de vie d'une commande (transitions autorisees : CommandeWorkflow).
 * Sprint 2 bis : PENDING_PARTNER -> ACCEPTEE | REFUSEE | ANNULEE, ACCEPTEE -> EN_PREPARATION -> PRETE -> AFFECTEE -> RECUPEREE.
 * Sprint 3 : RECUPEREE -> A_PROXIMITE (coursier a moins de 300 m) -> LIVREE.
 * EN_COURS, ARRIVEE, ECHEC, RETOURNEE : reserves (echecs : Sprint 7).
 */
public enum StatutLivraison {
    PENDING_PARTNER, ACCEPTEE, REFUSEE, EN_PREPARATION, PRETE, AFFECTEE, RECUPEREE, ANNULEE,
    EN_COURS, A_PROXIMITE, ARRIVEE, LIVREE, ECHEC, RETOURNEE
}
