package com.fleetpulse.livraison.Dto;

import com.fleetpulse.livraison.Model.Livreur;

public record LivreurResponse(
        Long id,
        String nom,
        String prenom,
        String email,
        String telephone,
        boolean actif,
        Long vehiculeId) {

    public static LivreurResponse from(Livreur livreur) {
        return new LivreurResponse(
                livreur.getId(), livreur.getNom(), livreur.getPrenom(), livreur.getEmail(),
                livreur.getTelephone(), livreur.isActif(),
                livreur.getVehicule() == null ? null : livreur.getVehicule().getId());
    }
}
