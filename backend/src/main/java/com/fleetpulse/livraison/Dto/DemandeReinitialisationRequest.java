package com.fleetpulse.livraison.Dto;

/** Mot de passe oublie (US-107) : email ou telephone du compte. */
public record DemandeReinitialisationRequest(String identifiant) {
}
