package com.fleetpulse.livraison.Service;

import java.time.*;
import java.time.temporal.ChronoUnit;

/** Dates civiles incluses, converties une fois en bornes UTC semi-ouvertes. */
public record PeriodeBi(LocalDate debut, LocalDate fin, Instant depuis, Instant jusqua) {
    public static PeriodeBi de(LocalDate debut, LocalDate fin) {
        LocalDate dernier = fin == null ? LocalDate.now(MessagesStatut.FUSEAU) : fin;
        LocalDate premier = debut == null ? dernier.minusDays(29) : debut;
        if (premier.isAfter(dernier) || ChronoUnit.DAYS.between(premier, dernier) > 365)
            throw new IllegalArgumentException("Choisissez une période de 1 à 366 jours, début avant fin.");
        return new PeriodeBi(premier, dernier, premier.atStartOfDay(MessagesStatut.FUSEAU).toInstant(),
                dernier.plusDays(1).atStartOfDay(MessagesStatut.FUSEAU).toInstant());
    }
}
