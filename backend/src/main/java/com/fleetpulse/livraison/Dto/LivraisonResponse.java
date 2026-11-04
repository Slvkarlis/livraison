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
        double montantTotal,          // articles + frais ; ancien repli pour les commandes historiques
        double montantACollecter,     // a encaisser par le livreur : 0 si deja paye par carte
        StatutLivraison statut,
        Instant dateCreation,
        Long partenaireId,
        String nomPartenaire,
        String zoneNom,
        java.math.BigDecimal montantArticles,
        java.util.List<MarketplaceDto.LigneVue> lignes,
        String notes,
        Integer tempsPreparationMinutes,   // US-2B2 : annonce a l'acceptation
        Instant accepteeLe,
        com.fleetpulse.livraison.Model.enums.MotifRefus motifRefus,
        String commentaireRefus,
        Instant pretePrevueLe,             // US-2B4 : fin de preparation annoncee (ajustable)
        Instant preparationDebutLe,
        Instant preteLe) {

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
                livraison.getDateCreation(),
                livraison.getPartenaire() == null ? null : livraison.getPartenaire().getId(),
                livraison.getNomPartenaire(), livraison.getNomZone(), livraison.getMontantArticles(),
                livraison.getLignes().stream().map(MarketplaceDto.LigneVue::from).toList(), livraison.getNotes(),
                livraison.getTempsPreparationMinutes(), livraison.getAccepteeLe(), livraison.getMotifRefus(), livraison.getCommentaireRefus(),
                livraison.heurePretePrevue(), livraison.getPreparationDebutLe(), livraison.getPreteLe());
    }

    /** Commandes creees avant la tarification automatique : seul montantACollecter etait renseigne. */
    public static double total(Livraison livraison) {
        if (livraison.getTotal() != null) return livraison.getTotal().doubleValue();
        double total = livraison.getFraisLivraison() + livraison.getSupplementImmediat();
        return total > 0 ? Math.round(total * 10) / 10.0 : livraison.getMontantACollecter();
    }
}
