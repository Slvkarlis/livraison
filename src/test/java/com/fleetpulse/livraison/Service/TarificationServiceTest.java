package com.fleetpulse.livraison.Service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fleetpulse.livraison.Config.DepotProperties;
import com.fleetpulse.livraison.Config.TarificationProperties;
import com.fleetpulse.livraison.Model.enums.TypeLivraison;
import com.fleetpulse.livraison.Service.TarificationService.Devis;
import org.junit.jupiter.api.Test;

class TarificationServiceTest {
    private static final double DEPOT_LAT = 36.8065;
    private static final double DEPOT_LNG = 10.1815;

    private final TarificationService service = new TarificationService(
            new TarificationProperties(1.3, 2.525, 7.0, 1.5, 0.4, 0.30, 3.0, 0.5, 25, 60),
            new DepotProperties("Depot", DEPOT_LAT, DEPOT_LNG));

    @Test
    void creneauAuTarifNormalCoutDeRevientPlusMarge() {
        // 0.045 deg de latitude ~ 5 km a vol d'oiseau -> 6.51 km de route
        Devis devis = service.devis(DEPOT_LAT + 0.045, DEPOT_LNG, TypeLivraison.PLANIFIEE);
        assertEquals(6.51, devis.distanceKm(), 0.01);
        double carburant = 6.51 * 7.0 / 100 * 2.525;
        double coutDeRevient = 1.5 + 0.4 * 6.51 + carburant;
        assertEquals(Math.round(coutDeRevient * 1.3 * 10) / 10.0, devis.fraisLivraison());
        assertEquals(6.8, devis.fraisLivraison());
        assertEquals(0.0, devis.supplementImmediat());
        assertEquals(devis.fraisLivraison(), devis.total());
    }

    @Test
    void livraisonImmediateAvecSupplement() {
        Devis planifiee = service.devis(DEPOT_LAT + 0.045, DEPOT_LNG, TypeLivraison.PLANIFIEE);
        Devis immediate = service.devis(DEPOT_LAT + 0.045, DEPOT_LNG, TypeLivraison.IMMEDIATE);
        assertEquals(planifiee.fraisLivraison(), immediate.fraisLivraison());
        assertEquals(10.2, immediate.total());
        assertEquals(3.4, immediate.supplementImmediat());
        assertEquals(immediate.total(), immediate.fraisLivraison() + immediate.supplementImmediat(), 0.001);
    }

    @Test
    void fraisMinimumPourLesCourtsTrajets() {
        Devis devis = service.devis(DEPOT_LAT + 0.001, DEPOT_LNG, TypeLivraison.PLANIFIEE);
        assertEquals(3.0, devis.fraisLivraison());
    }

    @Test
    void prixCroissantAvecLaDistance() {
        double proche = service.devis(DEPOT_LAT + 0.03, DEPOT_LNG, TypeLivraison.PLANIFIEE).total();
        double loin = service.devis(DEPOT_LAT + 0.10, DEPOT_LNG, TypeLivraison.PLANIFIEE).total();
        assertEquals(true, loin > proche);
    }

    @Test
    void adresseHorsZoneRefusee() {
        // Sousse est a ~120 km de Tunis
        assertThrows(IllegalArgumentException.class,
                () -> service.devis(35.8256, 10.6084, TypeLivraison.PLANIFIEE));
    }
}
