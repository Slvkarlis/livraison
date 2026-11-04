package com.fleetpulse.livraison.Dto;

import com.fleetpulse.livraison.Model.enums.StatutLivraison;

/** Message temps reel /user/queue/commandes : l'application recharge la commande concernee. ancien null = nouvelle commande. */
public record EvenementCommande(Long commandeId, StatutLivraison ancien, StatutLivraison nouveau) { }
