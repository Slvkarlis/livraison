package com.fleetpulse.livraison.Dto;

/** Demande d'un OTP d'inscription par SMS (US-101). */
public record DemandeCodeRequest(String telephone) {
}
