package com.fleetpulse.livraison.Config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Parametres de tarification (voir application.properties).
 *
 * coutDeRevient  = remunerationBase + remunerationParKm * km + carburant(km, consommationReference, prixCarburantLitre)
 * fraisLivraison = max(fraisMinimum, coutDeRevient * (1 + margeBeneficiaire))
 * immediate      = fraisLivraison * (1 + majorationImmediate)
 */
@ConfigurationProperties(prefix = "app.tarification")
public record TarificationProperties(
        double facteurRoute,
        double prixCarburantLitre,
        double consommationReference,
        double remunerationBase,
        double remunerationParKm,
        double margeBeneficiaire,
        double fraisMinimum,
        double majorationImmediate,
        double distanceMaxKm,
        int delaiImmediatMinutes) {
}
