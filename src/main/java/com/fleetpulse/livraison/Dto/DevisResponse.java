package com.fleetpulse.livraison.Dto;

import com.fleetpulse.livraison.Model.enums.TypeLivraison;
import com.fleetpulse.livraison.Service.TarificationService.Devis;

public record DevisResponse(
        TypeLivraison typeLivraison,
        double distanceKm,
        double fraisLivraison,
        double supplementImmediat,
        double total,
        int delaiImmediatMinutes) {

    public static DevisResponse from(TypeLivraison type, Devis devis, int delaiImmediatMinutes) {
        return new DevisResponse(type, devis.distanceKm(), devis.fraisLivraison(), devis.supplementImmediat(),
                devis.total(), delaiImmediatMinutes);
    }
}
