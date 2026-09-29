package com.fleetpulse.livraison.Dto;

/** Inscription publique : cree toujours un compte CLIENT (US-04). */
public record SignupRequest(
        String nom,
        String prenom,
        String email,
        String motDePasse,
        String telephone) {
}
