package com.fleetpulse.livraison.Dto;

import com.fleetpulse.livraison.Model.Livraison;
import com.fleetpulse.livraison.Model.enums.ModePaiement;
import com.fleetpulse.livraison.Model.enums.StatutLivraison;
import java.time.Instant;

public record LivraisonResponse(
        Long id,
        String codeSuivi,
        String clientEmail,
        String adresse,
        Double latitude,
        Double longitude,
        Instant creneauDebut,
        Instant creneauFin,
        ModePaiement modePaiement,
        double montantACollecter,
        StatutLivraison statut,
        Instant dateCreation) {

    public static LivraisonResponse from(Livraison livraison) {
        return new LivraisonResponse(
                livraison.getId(),
                livraison.getCodeSuivi(),
                livraison.getClient().getEmail(),
                livraison.getAdresse(),
                livraison.getLatitude(),
                livraison.getLongitude(),
                livraison.getCreneauDebut(),
                livraison.getCreneauFin(),
                livraison.getModePaiement(),
                livraison.getMontantACollecter(),
                livraison.getStatut(),
                livraison.getDateCreation());
    }
}
