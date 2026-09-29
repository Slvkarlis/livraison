package com.fleetpulse.livraison.Dto;

import com.fleetpulse.livraison.Model.Livraison;
import com.fleetpulse.livraison.Model.enums.ModePaiement;
import com.fleetpulse.livraison.Model.enums.StatutLivraison;
import com.fleetpulse.livraison.Model.enums.StatutPaiement;
import com.fleetpulse.livraison.Model.enums.TypeLivraison;
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
        TypeLivraison typeLivraison,
        ModePaiement modePaiement,
        StatutPaiement statutPaiement,
        double distanceKm,
        double fraisLivraison,
        double supplementImmediat,
        double montantTotal,          // prix de la livraison (frais + supplement)
        double montantACollecter,     // a encaisser par le livreur : 0 si deja paye par carte
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
                livraison.getTypeLivraison(),
                livraison.getModePaiement(),
                livraison.getStatutPaiement(),
                livraison.getDistanceKm(),
                livraison.getFraisLivraison(),
                livraison.getSupplementImmediat(),
                total(livraison),
                livraison.getMontantACollecter(),
                livraison.getStatut(),
                livraison.getDateCreation());
    }

    /** Commandes creees avant la tarification automatique : seul montantACollecter etait renseigne. */
    public static double total(Livraison livraison) {
        double total = livraison.getFraisLivraison() + livraison.getSupplementImmediat();
        return total > 0 ? Math.round(total * 10) / 10.0 : livraison.getMontantACollecter();
    }
}
