package com.fleetpulse.livraison.Config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Cles Stripe (mode test : sk_test_... / pk_test_...), fournies par variables d'environnement.
 * Sans cle secrete, le paiement par carte est simplement desactive.
 */
@ConfigurationProperties(prefix = "app.stripe")
public record StripeProperties(String cleSecrete, String clePublique, String cleWebhook, String devise) {

    public boolean actif() {
        return cleSecrete != null && !cleSecrete.isBlank() && clePublique != null && !clePublique.isBlank();
    }
}
