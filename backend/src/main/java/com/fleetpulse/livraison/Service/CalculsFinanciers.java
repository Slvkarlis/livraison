package com.fleetpulse.livraison.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;

/**
 * Sprint 5 : regles de calcul financieres, en un seul endroit. Montants en dinars, 3 decimales (millimes), arrondi au plus proche.
 * <ul>
 *   <li>US-501 : commission = articles x taux ; net partenaire = articles - commission (les frais de livraison restent a la plateforme) ;</li>
 *   <li>US-512 : remuneration d'une mission = base + prix par km x distance commerce -> client (detour urbain compris) ;</li>
 *   <li>US-506 : une semaine de closing va du lundi 00:00 au lundi suivant, heure de Tunisie.</li>
 * </ul>
 */
public final class CalculsFinanciers {
    /** US-501 : commission par defaut tant qu'aucun taux global n'est configure. */
    public static final BigDecimal TAUX_PAR_DEFAUT = new BigDecimal("12.00");
    /** US-512 : bareme par defaut d'une zone sans bareme. */
    public static final BigDecimal BASE_PAR_DEFAUT = new BigDecimal("3.000");
    public static final BigDecimal PAR_KM_PAR_DEFAUT = new BigDecimal("0.500");
    private static final BigDecimal CENT = new BigDecimal("100");

    private CalculsFinanciers() { }

    public record Semaine(LocalDate lundi, Instant debut, Instant fin) { }

    public static BigDecimal argent(BigDecimal valeur) {
        return (valeur == null ? BigDecimal.ZERO : valeur).setScale(3, RoundingMode.HALF_UP);
    }

    public static BigDecimal commission(BigDecimal articles, BigDecimal tauxPourcent) {
        return argent(argent(articles).multiply(tauxPourcent).divide(CENT, 6, RoundingMode.HALF_UP));
    }

    public static BigDecimal net(BigDecimal articles, BigDecimal commission) {
        return argent(articles).subtract(argent(commission));
    }

    public static BigDecimal remuneration(BigDecimal base, BigDecimal parKm, double distanceKm) {
        BigDecimal km = BigDecimal.valueOf(Math.max(0, distanceKm)).setScale(3, RoundingMode.HALF_UP);
        return argent(argent(base).add(argent(parKm).multiply(km)));
    }

    /** Distance commerce -> client retenue pour la remuneration : vol d'oiseau x detour, au metre pres. */
    public static double distanceMission(double latCommerce, double lngCommerce, double latClient, double lngClient) {
        return Math.round(Distances.km(latCommerce, lngCommerce, latClient, lngClient) * EstimationArrivee.FACTEUR_DETOUR * 1000) / 1000.0;
    }

    /** Semaine (lundi -> lundi suivant, heure de Tunisie) contenant le jour donne. */
    public static Semaine semaine(LocalDate jour) {
        LocalDate lundi = jour.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        return new Semaine(lundi, lundi.atStartOfDay(MessagesStatut.FUSEAU).toInstant(),
                lundi.plusWeeks(1).atStartOfDay(MessagesStatut.FUSEAU).toInstant());
    }

    /** Numero de recu lisible et unique : RC-2026-000042. */
    public static String numeroRecu(Long id, Instant date) {
        return "RC-" + date.atZone(MessagesStatut.FUSEAU).getYear() + "-" + String.format("%06d", id);
    }

    /** Taux en pourcentage, de 0 a 100, 2 decimales au plus. */
    public static BigDecimal taux(BigDecimal valeur) {
        if (valeur == null || valeur.signum() < 0 || valeur.compareTo(CENT) > 0 || valeur.stripTrailingZeros().scale() > 2)
            throw new IllegalArgumentException("Taux de commission : de 0 à 100 %, deux décimales au plus.");
        return valeur.setScale(2, RoundingMode.UNNECESSARY);
    }

    /** Montant saisi par le responsable : positif ou nul, 3 decimales au plus. */
    public static BigDecimal montantSaisi(BigDecimal valeur, String libelle) {
        if (valeur == null || valeur.signum() < 0 || valeur.stripTrailingZeros().scale() > 3 || valeur.compareTo(new BigDecimal("1000000")) > 0)
            throw new IllegalArgumentException(libelle + " : montant positif, trois décimales au plus.");
        return valeur.setScale(3, RoundingMode.UNNECESSARY);
    }
}
