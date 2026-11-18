package com.fleetpulse.livraison.Service;

import static org.junit.jupiter.api.Assertions.*;
import java.time.*;
import org.junit.jupiter.api.Test;

class PeriodeBiTest {
    @Test void bornesInclusivesEnTunisieEtPériodeBornee() {
        var p = PeriodeBi.de(LocalDate.of(2026, 11, 17), LocalDate.of(2026, 11, 17));
        assertEquals(Instant.parse("2026-11-16T23:00:00Z"), p.depuis());
        assertEquals(Instant.parse("2026-11-17T23:00:00Z"), p.jusqua());
        assertThrows(IllegalArgumentException.class, () -> PeriodeBi.de(p.fin().plusDays(1), p.fin()));
        assertThrows(IllegalArgumentException.class, () -> PeriodeBi.de(p.fin().minusDays(366), p.fin()));
    }
}
