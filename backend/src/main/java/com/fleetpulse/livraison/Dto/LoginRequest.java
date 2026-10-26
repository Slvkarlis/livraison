package com.fleetpulse.livraison.Dto;

/** "email" accepte aussi un numero de telephone (compte cree par OTP). */
public record LoginRequest(String email, String motDePasse) {
}
