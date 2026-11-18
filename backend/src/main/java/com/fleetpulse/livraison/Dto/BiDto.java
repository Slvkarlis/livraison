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
}
