package com.fleetpulse.livraison.Service;

import static com.fleetpulse.livraison.Model.enums.StatutLivraison.*;
import static org.junit.jupiter.api.Assertions.*;
import com.fleetpulse.livraison.Service.EstimationArrivee.Point;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class EstimationArriveeTest {
    static final Instant MAINTENANT = Instant.parse("2026-11-13T12:00:00Z");
    static final Point COMMERCE = new Point(36.80, 10.18);
    /** 0,1 degre de latitude : 11,12 km, x 1,3 = 14,45 km, soit 43,4 min a 20 km/h. */
    static final Point CLIENT = new Point(36.90, 10.18);

    static long minutes(Instant eta) { return Duration.between(MAINTENANT, eta).toMinutes(); }

    @Test void avantLaCollecteLaPreparationRestanteCompte() {
        Instant prete = MAINTENANT.plusSeconds(15 * 60);
        assertEquals(15 + 2 + 43, minutes(EstimationArrivee.heure(EN_PREPARATION, MAINTENANT, prete, COMMERCE, CLIENT, null, 20).orElseThrow()));
        // Preparation deja depassee : on part de maintenant
        assertEquals(2 + 43, minutes(EstimationArrivee.heure(PRETE, MAINTENANT, MAINTENANT.minusSeconds(600), COMMERCE, CLIENT, null, 20).orElseThrow()));
    }

    @Test void coursierLoinDuCommerceRetardeLaCollecte() {
        Point livreur = new Point(36.70, 10.18);   // 43 min du commerce, la commande est prete dans 10 min
        Instant prete = MAINTENANT.plusSeconds(600);
        assertEquals(43 + 2 + 43, minutes(EstimationArrivee.heure(AFFECTEE, MAINTENANT, prete, COMMERCE, CLIENT, livreur, 20).orElseThrow()));
    }

    @Test void colisABordDepuisLaPositionDuCoursier() {
        Point aMiChemin = new Point(36.85, 10.18);
        assertEquals(21, minutes(EstimationArrivee.heure(RECUPEREE, MAINTENANT, null, COMMERCE, CLIENT, aMiChemin, 20).orElseThrow()));
        assertEquals(43, minutes(EstimationArrivee.heure(A_PROXIMITE, MAINTENANT, null, COMMERCE, CLIENT, null, 20).orElseThrow()),
                "position inconnue : depuis le commerce");
        assertEquals(10, minutes(EstimationArrivee.heure(RECUPEREE, MAINTENANT, null, COMMERCE, CLIENT, aMiChemin, 40).orElseThrow()));
    }

    @Test void pasdEtaHorsLivraison() {
        for (var statut : new com.fleetpulse.livraison.Model.enums.StatutLivraison[] { PENDING_PARTNER, REFUSEE, ANNULEE, LIVREE })
            assertTrue(EstimationArrivee.heure(statut, MAINTENANT, null, COMMERCE, CLIENT, null, 20).isEmpty(), statut.name());
    }
}
