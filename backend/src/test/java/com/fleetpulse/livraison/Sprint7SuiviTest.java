package com.fleetpulse.livraison;

import static org.junit.jupiter.api.Assertions.*;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

/** Sprint 7 : guidage du coursier (US-307), simulateur de lots (US-518), pilote sur trois zones au plus (US-519). */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=jdbc:h2:mem:sprint7suivi;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
        "app.sprint2.donnees-demo=false", "app.commandes.intervalle-secondes=0", "app.commandes.actives-max=10" })
class Sprint7SuiviTest extends ParcoursSprint3 {

    @Test void guidageVersLeClientApresCollecte() throws Exception {
        Coursier sami = coursierDisponible("Sami");
        Coursier autre = coursierDisponible("Autre");
        long id = commandeCollectee(sami);

        var g = succes(200, appel("GET", "/livreur/missions/" + id + "/guidage", null, sami.token()));
        assertEquals("LIVRAISON", g.get("phase").asText());
        assertEquals("estimation", g.get("source").asText(), "sans OSRM configuré : estimation documentée");
        assertTrue(g.get("distanceKm").asDouble() >= 0);
        assertTrue(g.get("dureeMinutes").asDouble() >= 0);
        succes(404, appel("GET", "/livreur/missions/" + id + "/guidage", null, autre.token()));
    }

    @Test void simulateurComparaLotsEtUnitaire() throws Exception {
        Map<String, Object> scenario = Map.of(
                "depart", Map.of("latitude", 36.80, "longitude", 10.18),
                "vitesseKmh", 20,
                "commandes", List.of(
                        Map.of("id", 1, "zoneId", 1, "commerce", Map.of("latitude", 36.801, "longitude", 10.181), "client", Map.of("latitude", 36.805, "longitude", 10.185)),
                        Map.of("id", 2, "zoneId", 1, "commerce", Map.of("latitude", 36.802, "longitude", 10.182), "client", Map.of("latitude", 36.806, "longitude", 10.186)),
                        Map.of("id", 3, "zoneId", 1, "commerce", Map.of("latitude", 36.900, "longitude", 10.300), "client", Map.of("latitude", 36.905, "longitude", 10.305))),
                "voisines", Map.of("1", List.of(1)));
        var r = succes(200, appel("POST", "/admin/simulateur/lots", scenario, admin));
        assertEquals(3, r.get("unitaire").get("tournees").asInt());
        assertEquals(12, r.get("combinaisons").size(), "4 rayons x 3 fenêtres");
        assertTrue(r.get("combinaisons").get(0).get("lots").get("tournees").asInt() <= 3);
        succes(403, appel("POST", "/admin/simulateur/lots", scenario, client));
    }

    @Test void pilotePlafonneATroisZones() throws Exception {
        List<Long> ids = new java.util.ArrayList<>();
        for (int i = 0; i < 4; i++) ids.add(creerZone("Pilote " + i + " " + System.nanoTime(), 40 + i * 2, 10));
        for (int i = 0; i < 3; i++) {
            assertTrue(succes(200, appel("PUT", "/admin/pilote/zones/" + ids.get(i), Map.of("pilote", true), admin)).get("pilote").asBoolean());
        }
        succes(409, appel("PUT", "/admin/pilote/zones/" + ids.get(3), Map.of("pilote", true), admin));
        succes(200, appel("PUT", "/admin/pilote/zones/" + ids.get(0), Map.of("pilote", false), admin));
        assertTrue(succes(200, appel("PUT", "/admin/pilote/zones/" + ids.get(3), Map.of("pilote", true), admin)).get("pilote").asBoolean(),
                "une place libérée permet d'en ajouter une autre");
        assertEquals(3, succes(200, appel("GET", "/admin/pilote/zones", null, admin)).findValues("pilote").stream()
                .filter(n -> n.asBoolean()).count(), "trois zones pilotes au total");
        assertTrue(succes(200, appel("GET", "/admin/pilote/kpi", null, admin)).size() >= 3);
    }
}
