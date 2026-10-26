package com.fleetpulse.livraison.Dto;

/** Inscription client confirmee par l'OTP recu au telephone (US-101). */
public record InscriptionTelephoneRequest(
        String telephone,
        String code,
        String nom,
        String prenom,
        String email,
        String motDePasse) {
}
