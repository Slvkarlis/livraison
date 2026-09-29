package com.fleetpulse.livraison.Dto;

public record CreateVehiculeRequest(String immatriculation, String type, Double capaciteKg,
									Double consommationLitres100Km) {
}
