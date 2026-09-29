package com.fleetpulse.livraison.Dto;

import com.fleetpulse.livraison.Model.enums.ModePaiement;
import java.time.Instant;

public record CreateLivraisonRequest(
        String adresse,
        Double latitude,
        Double longitude,
        Instant creneauDebut,
        Instant creneauFin,
        ModePaiement modePaiement,
        double montantACollecter) {
}
