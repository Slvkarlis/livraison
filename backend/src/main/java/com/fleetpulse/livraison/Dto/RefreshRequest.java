package com.fleetpulse.livraison.Dto;

public record RefreshRequest(String refreshToken) {
    @Override
    public String toString() { return "RefreshRequest[confidentiel]"; }
}
