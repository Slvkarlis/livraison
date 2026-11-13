package com.fleetpulse.livraison.Service;

import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;

class DistancesTest {
    @Test void unDegreDeLatitudeFaitEnviron111Km() {
        assertEquals(111.19, Distances.km(0, 0, 1, 0), 0.05);
        assertEquals(0, Distances.km(36.8, 10.18, 36.8, 10.18), 1e-9);
    }

    @Test void tunisAriana() {
        // Tunis centre (36.81, 10.18) -> Ariana (36.88, 10.18) : 7,8 km a vol d'oiseau
        assertEquals(7.78, Distances.km(36.81, 10.18, 36.88, 10.18), 0.05);
    }
}
