package com.fleetpulse.livraison.Model.enums;

/**
 * US-403 / US-405 : cycle de vie d'un lot de 1 a 3 commandes.
 * PROPOSE : lot forme, propose a un coursier ou en attente d'un coursier ; ACCEPTE : un coursier l'a pris en charge ;
 * ANNULE : lot dissous (commandes annulees ou reprises par une affectation forcee), ses commandes retournent au dispatch.
 */
public enum StatutLot { PROPOSE, ACCEPTE, ANNULE }
