package com.fleetpulse.livraison.Dto;

import com.fleetpulse.livraison.Service.PeriodeBi;
import java.math.BigDecimal;

public final class BiDto {
    private BiDto() { }
    public record FinanceVue(PeriodeBi periode, BigDecimal gmv, BigDecimal ventesArticles,
            BigDecimal commissionsNettes, BigDecimal margeLivraison, BigDecimal cashEnCirculation,
            BigDecimal reversementsAEffectuer, BigDecimal remunerationsAEffectuer,
            BigDecimal reversementsEffectues, BigDecimal remunerationsEffectuees, long articlesVendus) { }
    public record Attentes(BigDecimal reversements, BigDecimal remunerations) { }
}
