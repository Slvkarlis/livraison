package com.fleetpulse.livraison.Dto;

/** Jeton d'acces (JWT, courte duree) + jeton de rafraichissement (US-102). */
public record LoginResponse(String token, String type, long expiresInMs, String refreshToken, long refreshExpiresInMs) {
    @Override
    public String toString() { return "LoginResponse[confidentiel]"; }
}
