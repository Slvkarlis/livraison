package com.fleetpulse.livraison.Service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Cle HMAC des QR de remise (US-305). Par defaut derivee du secret JWT ; APP_REMISE_SECRET pour la separer. */
@Component
public class SecretRemise {
    private final String valeur;

    public SecretRemise(@Value("${app.remise.secret:${app.jwt.secret}}") String valeur) {
        if (valeur == null || valeur.length() < 32) throw new IllegalStateException("app.remise.secret : 32 caractères minimum.");
        this.valeur = valeur;
    }

    String valeur() { return valeur; }
}
