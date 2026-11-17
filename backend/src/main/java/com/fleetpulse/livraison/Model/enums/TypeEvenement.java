package com.fleetpulse.livraison.Model.enums;

/**
 * US-401 : familles d'evenements historises dans l'entrepot pour alimenter les modeles d'IA.
 * Les traces GPS sont deja historisees (PositionLivreur, immuable) et les zones sont exportees avec leur etat courant.
 */
public enum TypeEvenement { STATUT, PREPARATION, OFFRE, AFFECTATION }
