package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Model.enums.StatutLivraison;

/** Evenement publie a chaque changement de statut ; DiffusionTempsReel le pousse au partenaire et au client (emails = identifiants STOMP). */
public record CommandeStatutChange(Long commandeId, Long partenaireId, String partenaireEmail, Long clientId, String clientEmail,
                                   StatutLivraison ancien, StatutLivraison nouveau) { }
