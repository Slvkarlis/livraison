package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Model.enums.StatutLivraison;

/** Evenement publie a chaque changement de statut (le temps reel s'y abonnera). */
public record CommandeStatutChange(Long commandeId, Long partenaireId, Long clientId, StatutLivraison ancien, StatutLivraison nouveau) { }
