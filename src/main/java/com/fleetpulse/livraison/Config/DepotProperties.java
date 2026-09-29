package com.fleetpulse.livraison.Config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Depot unique d'ou partent toutes les livraisons. */
@ConfigurationProperties(prefix = "app.depot")
public record DepotProperties(String adresse, double latitude, double longitude) {
}
