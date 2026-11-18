package com.fleetpulse.livraison.Dto;

import com.fleetpulse.livraison.Service.PeriodeBi;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import com.fleetpulse.livraison.Model.enums.StatutLivraison;

public final class BiDto {
    private BiDto() { }
    public record FinanceVue(PeriodeBi periode, BigDecimal gmv, BigDecimal ventesArticles,
            BigDecimal commissionsNettes, BigDecimal margeLivraison, BigDecimal cashEnCirculation,
            BigDecimal reversementsAEffectuer, BigDecimal remunerationsAEffectuer,
            BigDecimal reversementsEffectues, BigDecimal remunerationsEffectuees, long articlesVendus) { }
    public record Attentes(BigDecimal reversements, BigDecimal remunerations) { }
    public record StatutVue(StatutLivraison statut, long commandes) { }
    public record ZoneVue(Long id, String nom, double latitude, double longitude, long commandes, long livrees,
            long commandesActives, long coursiersDisponibles, Double couverturePourcent) { }
    public record OperationsVue(PeriodeBi periode, Instant observeLe, List<StatutVue> statuts, List<ZoneVue> zones,
            Double gainDistanceKm, Double gainTempsMinutes, String indisponibiliteGains) { }
    public record MotifVue(String motif, long commandes) { }
    public record PartenaireVue(Long id, String nomCommerce, long commandes, long acceptees, long refusees,
            Double tauxAcceptation, Double tauxRefus, Double preparationEstimeeMinutes, Double preparationReelleMinutes,
            long preparationsMesurees, Double noteMoyenne, long nombreNotes, Integer classement, List<MotifVue> motifs,
            Double tauxExpiration, Long reclamations) { }
    public record PartenairesVue(PeriodeBi periode, List<PartenaireVue> partenaires) { }
    public record CoursierVue(Long id, long missions, Double minutesParKm, long trajetsMesures, long etaMesurables,
            long etaRespectes, Double respectEtaPourcent, Double delaiDepotHeures, long depotsMesures,
            long missionsNonDeposees, long ecartsDepot, Double noteMoyenne, long nombreNotes) { }
    public record ProductiviteZoneVue(Long id, String nom, long livraisons, long coursiers, double distanceEstimeeKm,
            double livraisonsParJour, Double missionsParCoursier) { }
    public record CoursiersVue(PeriodeBi periode, List<CoursierVue> coursiers, List<ProductiviteZoneVue> zones) { }
    public record ProduitVenduVue(Long id, String nom, long quantite, BigDecimal chiffreAffaires) { }
    public record VentesVue(PeriodeBi periode, BigDecimal chiffreAffaires, long commandes, List<ProduitVenduVue> meilleursProduits) { }
}
