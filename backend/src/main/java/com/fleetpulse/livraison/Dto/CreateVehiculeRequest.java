package com.fleetpulse.livraison.Dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Création ou modification d’un véhicule. En modification, les champs absents sont conservés.")
public record CreateVehiculeRequest(
        @Schema(description = "Obligatoire à la création ; normalisée en majuscules", example = "123 TU 456") String immatriculation,
        @Schema(description = "Type du véhicule", example = "Scooter") String type,
        @Schema(description = "Capacité de transport en kilogrammes", example = "30") Double capaciteKg,
        @Schema(description = "Consommation de 2 à 30 litres aux 100 kilomètres", example = "3.5", minimum = "2", maximum = "30") Double consommationLitres100Km) {
}
