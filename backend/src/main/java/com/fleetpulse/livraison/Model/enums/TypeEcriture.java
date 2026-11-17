package com.fleetpulse.livraison.Model.enums;

/**
 * US-503 : nature d'une ecriture du ledger financier. Montants toujours positifs : le type porte le sens.
 * <ul>
 *   <li>a la livraison : GMV (articles vendus), COMMISSION (revenu plateforme), NET_PARTENAIRE (du au commerce),
 *       FRAIS_LIVRAISON (revenu plateforme), CASH_COURSIER (especes detenues par le coursier), REMUNERATION_COURSIER (due au coursier),
 *       ECART_ENCAISSEMENT (montant encaisse different du total, motive) ;</li>
 *   <li>au depot (US-505) : DEPOT_CASH (especes remises au responsable), ECART_DEPOT (manque ou surplus au depot) ;</li>
 *   <li>au closing (US-506, US-512) : REVERSEMENT_PARTENAIRE, PAIEMENT_COURSIER ;</li>
 *   <li>reserves aux litiges (Sprint 7) : COMPENSATION, REMBOURSEMENT.</li>
 * </ul>
 */
public enum TypeEcriture {
    GMV, COMMISSION, NET_PARTENAIRE, FRAIS_LIVRAISON, CASH_COURSIER, REMUNERATION_COURSIER, ECART_ENCAISSEMENT,
    DEPOT_CASH, ECART_DEPOT, REVERSEMENT_PARTENAIRE, PAIEMENT_COURSIER, COMPENSATION, REMBOURSEMENT
}
