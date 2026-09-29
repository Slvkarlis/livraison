package com.fleetpulse.livraison.Dto;

/** clientSecret du PaymentIntent pour la PaymentSheet ; dejaPaye si Stripe a deja encaisse. */
public record PaiementResponse(String clientSecret, double montant, String devise, boolean dejaPaye) {
}
