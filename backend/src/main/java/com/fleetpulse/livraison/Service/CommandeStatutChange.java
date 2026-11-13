package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Model.enums.Role;
import com.fleetpulse.livraison.Model.enums.StatutLivraison;

/**
 * Evenement publie a chaque changement de statut ; DiffusionTempsReel le pousse au partenaire, au client
 * et au coursier affecte (emails = identifiants STOMP ; null si la commande n'en a pas).
 * acteurRole (US-304) : qui a fait le changement ; null pour le systeme. Le client n'est pas notifie de ses propres actions.
 */
public record CommandeStatutChange(Long commandeId, Long partenaireId, String partenaireEmail, Long clientId, String clientEmail,
                                   String livreurEmail, StatutLivraison ancien, StatutLivraison nouveau, Role acteurRole) { }
