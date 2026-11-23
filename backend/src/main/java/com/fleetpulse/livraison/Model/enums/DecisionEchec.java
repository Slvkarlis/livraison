package com.fleetpulse.livraison.Model.enums;

/**
 * US-312 : sort d'une commande en echec, decide par le responsable.
 * RELIVRAISON : le colis reste a bord, la commande repasse en RECUPEREE.
 * RETOUR_PARTENAIRE : le colis retourne au commerce (statut RETOURNEE, terminal).
 * PERTE : colis considere perdu ; la decision est tracee, la reimputation est traitee par US-517.
 */
public enum DecisionEchec {
    RELIVRAISON, RETOUR_PARTENAIRE, PERTE
}
