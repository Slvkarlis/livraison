package com.fleetpulse.livraison.Dto;

/** Dossier d'inscription d'un commercant (US-104). */
public record InscriptionPartenaireRequest(
        String nom,
        String prenom,
        String email,
        String telephone,
        String motDePasse,
        String nomCommerce,
        String categorie,
        String adresse,
        Double latitude,
        Double longitude,
        String matriculeFiscal) {
}
