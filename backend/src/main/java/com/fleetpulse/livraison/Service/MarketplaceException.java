package com.fleetpulse.livraison.Service;
import lombok.Getter;
@Getter
public class MarketplaceException extends RuntimeException {
    private final int statut;
    private final String code;
    public MarketplaceException(int statut, String code, String message) { super(message); this.statut = statut; this.code = code; }
    public static MarketplaceException absent() { return new MarketplaceException(404, "INTROUVABLE", "Élément introuvable."); }
    public static MarketplaceException conflit(String message) { return new MarketplaceException(409, "ETAT_INVALIDE", message); }
}
