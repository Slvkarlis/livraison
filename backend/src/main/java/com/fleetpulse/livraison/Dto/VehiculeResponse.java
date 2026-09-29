package com.fleetpulse.livraison.Dto;

import com.fleetpulse.livraison.Model.Vehicule;

public record VehiculeResponse(
        Long id,
        String immatriculation,
        String type,
        Double capaciteKg,
        double consommationLitres100Km,
        boolean actif,
        Long livreurId) {

    public static VehiculeResponse from(Vehicule vehicule) {
        return new VehiculeResponse(
                vehicule.getId(), vehicule.getImmatriculation(), vehicule.getType(),
                vehicule.getCapaciteKg(), vehicule.getConsommationLitres100Km(), vehicule.isActif(),
                vehicule.getLivreur() == null ? null : vehicule.getLivreur().getId());
    }
}
