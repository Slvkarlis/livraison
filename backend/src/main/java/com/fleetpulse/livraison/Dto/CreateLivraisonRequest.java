package com.fleetpulse.livraison.Dto;

import com.fleetpulse.livraison.Model.enums.ModePaiement;
import com.fleetpulse.livraison.Model.enums.TypeLivraison;
import java.time.Instant;

/** Le montant n'est pas saisi par le client : il est calcule par TarificationService. */
public record CreateLivraisonRequest(
        String adresse,
        Double latitude,
        Double longitude,
        TypeLivraison typeLivraison,
        Instant creneauDebut,       // ignores pour une livraison immediate
        Instant creneauFin,
        ModePaiement modePaiement) {
}
