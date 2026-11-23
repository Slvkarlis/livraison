package com.fleetpulse.livraison.Service;

import static org.junit.jupiter.api.Assertions.*;
import com.fleetpulse.livraison.Service.EstimationArrivee.Point;
import com.fleetpulse.livraison.Service.SimulateurLots.Commande;
import com.fleetpulse.livraison.Service.SimulateurLots.Scenario;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

/** US-518 : le simulateur est pur ; ses bilans se verifient sans base ni serveur. */
class SimulateurLotsTest {
    private final SimulateurLots simulateur = new SimulateurLots();

    @Test void commandesProchesSontGroupeesEtLaRecommandationExiste() {
        Scenario s = new Scenario(new Point(36.80, 10.18), 20,
                List.of(new Commande(1L, 1L, new Point(36.801, 10.181), new Point(36.803, 10.183)),
                        new Commande(2L, 1L, new Point(36.8015, 10.1815), new Point(36.804, 10.184))),
                Map.of(1L, Set.of(1L)));
        var r = simulateur.simuler(s);
        assertEquals(2, r.unitaire().tournees());
        assertEquals(12, r.combinaisons().size());
        assertTrue(r.combinaisons().stream().anyMatch(c -> c.lots().tournees() == 1), "deux commandes voisines : un seul lot");
        assertNotNull(r.recommandee());
    }

    @Test void refusDeScenariosInvalides() {
        assertThrows(IllegalArgumentException.class, () -> simulateur.simuler(new Scenario(new Point(0, 0), 20, List.of(), Map.of())));
        assertThrows(IllegalArgumentException.class, () -> simulateur.simuler(new Scenario(new Point(0, 0), 0,
                List.of(new Commande(1L, 1L, new Point(0, 0), new Point(0, 0))), Map.of())));
    }
}
