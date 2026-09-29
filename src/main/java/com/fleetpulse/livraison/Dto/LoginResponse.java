package com.fleetpulse.livraison.Dto;

public record LoginResponse(String token, String type, long expiresInMs) {
}
