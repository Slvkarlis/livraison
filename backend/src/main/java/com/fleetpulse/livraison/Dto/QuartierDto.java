package com.fleetpulse.livraison.Dto;

import com.fleetpulse.livraison.Model.enums.StatutGroupeQuartier;
import java.math.BigDecimal;
import java.time.Instant;
import io.swagger.v3.oas.annotations.media.Schema;

public final class QuartierDto {
    private QuartierDto() { }
    @Schema(description = "Offre publique anonyme. Aucun identifiant de membre ni point central privé.")
    public record GroupeProche(Long id, Long commerceId, String commerce, int nbMembres, BigDecimal reduction,
                               BigDecimal fraisLivraison, Instant expiration, long secondesRestantes) { }
    public record GroupeAdmin(Long id, Long commerceId, String commerce, StatutGroupeQuartier statut, int nbMembres,
                              double latitude, double longitude, double rayonMetres, Instant ouverture, Instant expiration,
                              Long lotId, double gainKm, BigDecimal gainDt) { }
    public record Statistiques(long ouverts, long fermes, long annules, double tauxRemplissage, double kmEconomises, BigDecimal dtEconomises) { }
    public record Preference(boolean recevoirInvitationsQuartier) { }
    public record Activation(boolean groupesQuartierActifs) { }
    public record Commerce(Long id, String nomCommerce, boolean groupesQuartierActifs) { }
}
