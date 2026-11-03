package com.fleetpulse.livraison.Dto;

public record ReinitialisationRequest(String identifiant, String code, String nouveauMotDePasse) {
    @Override
    public String toString() { return "ReinitialisationRequest[confidentiel]"; }
}
