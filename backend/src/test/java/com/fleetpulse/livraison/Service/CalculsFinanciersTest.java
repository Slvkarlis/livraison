package com.fleetpulse.livraison.Service;

import static org.junit.jupiter.api.Assertions.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

/** Sprint 5 : regles de calcul (commission, net, remuneration, semaine de closing, recu, validations). */
class CalculsFinanciersTest {
    static BigDecimal dt(String v) { return new BigDecimal(v); }

    @Test void commissionEtNetAuMillimePres() {
        assertEquals(dt("0.960"), CalculsFinanciers.commission(dt("8.000"), CalculsFinanciers.TAUX_PAR_DEFAUT));
        assertEquals(dt("7.040"), CalculsFinanciers.net(dt("8.000"), dt("0.960")));
        assertEquals(dt("0.917"), CalculsFinanciers.commission(dt("7.333"), dt("12.50")), "0,916625 arrondi au millime");
        assertEquals(dt("0.000"), CalculsFinanciers.commission(dt("8"), dt("0")));
    }

    @Test void remunerationBasePlusKilometres() {
        assertEquals(dt("6.616"), CalculsFinanciers.remuneration(dt("3"), dt("0.5"), 7.231));
        assertEquals(dt("3.000"), CalculsFinanciers.remuneration(dt("3"), dt("0.5"), -2), "distance negative ignoree");
        assertEquals(1.852, CalculsFinanciers.distanceMission(36.8, 10.18, 36.81, 10.19), 1e-9);
    }

    @Test void semaineDuLundiAuLundiHeureDeTunisie() {
        var s = CalculsFinanciers.semaine(LocalDate.parse("2026-11-18"));   // mercredi
        assertEquals(LocalDate.parse("2026-11-16"), s.lundi());
        assertEquals(Instant.parse("2026-11-15T23:00:00Z"), s.debut());
        assertEquals(Instant.parse("2026-11-22T23:00:00Z"), s.fin());
        assertEquals(s, CalculsFinanciers.semaine(LocalDate.parse("2026-11-16")), "le lundi lui-meme");
    }

    @Test void numeroDeRecuEtValidations() {
        assertEquals("RC-2026-000042", CalculsFinanciers.numeroRecu(42L, Instant.parse("2026-11-17T10:00:00Z")));
        assertEquals("RC-2027-000001", CalculsFinanciers.numeroRecu(1L, Instant.parse("2026-12-31T23:30:00Z")), "deja 2027 a Tunis");
        assertEquals(dt("12.50"), CalculsFinanciers.taux(dt("12.5")));
        assertThrows(IllegalArgumentException.class, () -> CalculsFinanciers.taux(dt("100.01")));
        assertThrows(IllegalArgumentException.class, () -> CalculsFinanciers.taux(dt("12.345")));
        assertThrows(IllegalArgumentException.class, () -> CalculsFinanciers.taux(null));
        assertEquals(dt("4.500"), CalculsFinanciers.montantSaisi(dt("4.5"), "Base"));
        assertThrows(IllegalArgumentException.class, () -> CalculsFinanciers.montantSaisi(dt("-1"), "Base"));
        assertThrows(IllegalArgumentException.class, () -> CalculsFinanciers.montantSaisi(dt("1.0001"), "Base"));
    }
}
