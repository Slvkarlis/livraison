package com.fleetpulse.livraison.Dto;

public record CreateLivreurRequest(
        String nom,
        String prenom,
        String email,
        String motDePasse,
        String telephone) {
}
