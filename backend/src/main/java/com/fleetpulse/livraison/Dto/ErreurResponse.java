package com.fleetpulse.livraison.Dto;

/** Corps JSON de toutes les erreurs renvoyees par l'API. */
public record ErreurResponse(String code, String message) {
}
