package com.fleetpulse.livraison.Dto;

/** Candidature d'un livreur : identite et vehicule (US-106). */
public record CandidatureLivreurRequest(
        String nom,
        String prenom,
        String email,
        String telephone,
        String motDePasse,
        String numeroIdentite,
        String vehiculeDeclare) {
}
