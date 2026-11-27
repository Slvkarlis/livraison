package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Service.EstimationArrivee.Point;
import com.fleetpulse.livraison.Service.SimulationQuartier.*;
import java.math.BigDecimal;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class SimulationQuartierTest {
    static Scenario scenario(double adhesion) {
        List<Demande> demandes = new ArrayList<>();
        for (int i = 0; i < 60; i++) demandes.add(new Demande(i + 1L, 1L, 1L, new Point(36.80, 10.18),
                new Point(36.82 + (i % 3) * .0003, 10.18 + (i % 5) * .0002), i * 90, 900, i * 90 + 3600, new BigDecimal("3.000")));
        return new Scenario(new Point(36.80, 10.18), 20, List.copyOf(demandes), adhesion, 480, 400);
    }
    @Test void comparaisonDeterministeMemesDemandesEtTroisTaux() {
        for (double taux : List.of(.1, .25, .4)) {
            Scenario s = scenario(taux); var r = SimulationQuartier.comparer(s);
            assertEquals(r, SimulationQuartier.comparer(s)); assertEquals(3, r.scenarios().size());
            r.scenarios().forEach(b -> { assertEquals(60, b.commandes()); assertEquals(100, b.aHeurePct()); });
            assertTrue(r.scenarios().getLast().kmTotaux() <= r.scenarios().getFirst().kmTotaux());
            assertTrue(r.scenarios().getLast().fraisMoyenClient().compareTo(new BigDecimal("3.000")) <= 0);
            for (var b : r.scenarios()) System.out.printf(java.util.Locale.ROOT,
                    "S9_SIM | %.0f%% | %s | %.3f | %s | %.3f | %.1f%% | %s%n", taux * 100, b.mode(), b.kmTotaux(), b.coutParCommande(), b.commandesParCoursierHeure(), b.aHeurePct(), b.fraisMoyenClient());
        }
    }
    @Test void adhesionZeroIdentiqueAuxLotsEtEntreesInvalidesRefusees() {
        var r = SimulationQuartier.comparer(scenario(0));
        assertEquals(r.scenarios().get(1).kmTotaux(), r.scenarios().get(2).kmTotaux());
        assertThrows(IllegalArgumentException.class, () -> SimulationQuartier.comparer(scenario(2)));
    }
}
