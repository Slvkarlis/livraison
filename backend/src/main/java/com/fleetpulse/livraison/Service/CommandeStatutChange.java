package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Model.enums.StatutLivraison;

/**
 * Evenement publie a chaque changement de statut ; DiffusionTempsReel le pousse au partenaire, au client
 * et au coursier affecte (emails = identifiants STOMP ; null si la commande n'en a pas).
 */
public record CommandeStatutChange(Long commandeId, Long partenaireId, String partenaireEmail, Long clientId, String clientEmail,
                                   String livreurEmail, StatutLivraison ancien, StatutLivraison nouveau) { }
