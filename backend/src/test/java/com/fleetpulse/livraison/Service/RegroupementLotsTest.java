package com.fleetpulse.livraison.Service;

import static org.junit.jupiter.api.Assertions.*;
import com.fleetpulse.livraison.Service.EstimationArrivee.Point;
import com.fleetpulse.livraison.Service.RegroupementLots.CommandeEnAttente;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

/** US-403 : regroupement par regles de collectes proches (zone identique ou adjacente). */
class RegroupementLotsTest {
    final Instant t0 = Instant.parse("2026-11-17T12:00:00Z");
    final Point commerce = new Point(36.800, 10.180), voisin = new Point(36.802, 10.181), loin = new Point(36.900, 10.300);
    final Point client = new Point(36.815, 10.185);
    final Duration aBord = Duration.ofMinutes(35);

    CommandeEnAttente cmd(long id, long zone, Point c, Instant prete) { return new CommandeEnAttente(id, zone, c, client, prete); }

    @Test void deuxCollectesProchesFormentUnLotEtUneLointaineResteSeule() {
        var lots = RegroupementLots.regrouper(List.of(cmd(1, 2, commerce, t0), cmd(2, 2, voisin, t0.plusSeconds(60)),
                cmd(3, 2, loin, t0.plusSeconds(30))), Map.of(), 1.5, 20, aBord);
        assertEquals(2, lots.size());
        assertEquals(List.of(1L, 2L), lots.getFirst().ids());
        assertEquals(List.of(3L), lots.get(1).ids());
        assertNotNull(lots.getFirst().itineraire());
    }

    @Test void auPlusTroisCommandesParLot() {
        var lots = RegroupementLots.regrouper(List.of(cmd(1, 2, commerce, t0), cmd(2, 2, commerce, t0), cmd(3, 2, commerce, t0),
                cmd(4, 2, commerce, t0)), Map.of(), 1.5, 20, aBord);
        assertEquals(RegroupementLots.TAILLE_MAX, lots.getFirst().commandes().size());
        assertEquals(1, lots.get(1).commandes().size());
    }

    @Test void zonesAdjacentesSeulementEtPretesAPeuPresEnMemeTemps() {
        var a = cmd(1, 2, commerce, t0);
        assertFalse(RegroupementLots.compatible(a, cmd(2, 5, voisin, t0), Map.of(), 1.5), "zone sans frontiere commune");
        assertTrue(RegroupementLots.compatible(a, cmd(2, 5, voisin, t0), Map.of(2L, Set.of(5L)), 1.5), "zone adjacente");
        assertFalse(RegroupementLots.compatible(a, cmd(2, 2, voisin, t0.plus(Duration.ofMinutes(11))), Map.of(), 1.5), "pretes trop eloignees");
        assertFalse(RegroupementLots.compatible(a, cmd(2, 2, loin, t0), Map.of(), 1.5), "commerces trop eloignes");
    }

    @Test void pasDeLotSiLaDureeABordEstDepassee() {
        var lots = RegroupementLots.regrouper(List.of(cmd(1, 2, commerce, t0), cmd(2, 2, voisin, t0)), Map.of(), 1.5, 20, Duration.ofMinutes(4));
        // Chaque commande part seule : regroupees, l'une d'elles resterait trop longtemps a bord
        assertEquals(2, lots.size());
        assertTrue(lots.stream().allMatch(l -> l.commandes().size() == 1 && l.itineraire() != null));
    }
}
