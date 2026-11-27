package com.fleetpulse.livraison.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Les frais sont calculés en millimes. La rémunération du coursier reste celle de BaremeService. */
public final class TarificationQuartier {
    private TarificationQuartier() { }
    public static BigDecimal frais(BigDecimal normal, BigDecimal annonce, int taille, boolean dernier,
                                    BigDecimal reductionDeux, BigDecimal reductionTrois) {
        BigDecimal taux = taille >= 3 ? (dernier ? BigDecimal.ONE : reductionTrois)
                : taille == 2 ? reductionDeux : BigDecimal.ZERO;
        BigDecimal resultat = normal.multiply(BigDecimal.ONE.subtract(taux)).setScale(3, RoundingMode.HALF_UP);
        return annonce == null ? resultat : resultat.min(annonce).setScale(3, RoundingMode.HALF_UP);
    }
}
