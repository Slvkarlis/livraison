package com.fleetpulse.livraison.Dto;

import com.fleetpulse.livraison.Model.enums.TypeAlerte;
import java.math.BigDecimal;
import java.time.Instant;

public final class AlerteDto {
    private AlerteDto() { }
    public record DemandeSeuil(BigDecimal valeur, Boolean actif) { }
    public record SeuilVue(TypeAlerte type, String libelle, String unite, BigDecimal valeur, BigDecimal maximum, boolean actif) { }
    public record AlerteVue(Long id, TypeAlerte type, String objet, Long objetId, BigDecimal valeur, BigDecimal seuil,
            String unite, Instant declencheeLe, Instant observeeLe) { }
}
