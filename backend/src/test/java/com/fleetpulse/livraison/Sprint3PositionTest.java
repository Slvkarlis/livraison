package com.fleetpulse.livraison;

import static org.junit.jupiter.api.Assertions.*;
import com.fleetpulse.livraison.Repository.PositionLivreurRepository;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

/** US-301 : le coursier transmet sa position GPS pendant ses missions (base H2). */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=jdbc:h2:mem:sprint3position;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
        "app.sprint2.donnees-demo=false", "app.commandes.intervalle-secondes=0", "app.commandes.actives-max=10" })
class Sprint3PositionTest extends ParcoursSprint3 {
    @Autowired PositionLivreurRepository positions;

    @Test void positionHistoriseeSeulementPendantUneMission() throws Exception {
        Coursier sami = coursierDisponible("Sami");
        var libre = succes(200, position(sami, latCommerce + .0001, lngCommerce));
        assertTrue(libre.get("acceptee").asBoolean());
        assertFalse(libre.get("enMission").asBoolean());
        assertTrue(positions.findAllByLivreurIdOrderByDateAscIdAsc(sami.id()).isEmpty(), "hors mission : pas d'historique");

        commandeCollectee(sami);
        var enMission = succes(200, position(sami, latCommerce + .0002, lngCommerce));
        assertTrue(enMission.get("acceptee").asBoolean());
        assertTrue(enMission.get("enMission").asBoolean());
        var trace = positions.findAllByLivreurIdOrderByDateAscIdAsc(sami.id());
        assertEquals(1, trace.size());
        assertEquals(latCommerce + .0002, trace.get(0).getLatitude(), 1e-9);
    }

    @Test void pointsAberrantsEcartes() throws Exception {
        Coursier sami = coursierDisponible("Sami");
        commandeCollectee(sami);
        var imprecis = succes(200, appel("PUT", "/livreur/position",
                Map.of("latitude", latCommerce, "longitude", lngCommerce, "precision", 900), sami.token()));
        assertFalse(imprecis.get("acceptee").asBoolean());
        assertTrue(imprecis.get("raison").asText().contains("imprécise"));

        // 55 km en quelques millisecondes : saut GPS
        var saut = succes(200, position(sami, latCommerce + .5, lngCommerce));
        assertFalse(saut.get("acceptee").asBoolean());
        assertTrue(positions.findAllByLivreurIdOrderByDateAscIdAsc(sami.id()).isEmpty());

        assertTrue(succes(200, position(sami, latCommerce + .0002, lngCommerce)).get("acceptee").asBoolean(), "22 m : retenu");
    }

    @Test void positionInvalideOuMauvaisRole() throws Exception {
        Coursier sami = coursierDisponible("Sami");
        succes(400, position(sami, 95, 10));
        succes(400, appel("PUT", "/livreur/position", Map.of("latitude", latCommerce), sami.token()));
        succes(400, appel("PUT", "/livreur/position", Map.of("latitude", latCommerce, "longitude", lngCommerce, "precision", -1), sami.token()));
        assertEquals(403, appel("PUT", "/livreur/position", Map.of("latitude", 1, "longitude", 1), client).status());
        assertEquals(401, appel("PUT", "/livreur/position", Map.of("latitude", 1, "longitude", 1), null).status());
    }

    @Test void adresseDuClientReveleeApresLaCollecte() throws Exception {
        Coursier sami = coursierDisponible("Sami");
        long id = commandePrete().get("id").asLong();
        var avant = succes(200, appel("GET", "/livreur/missions/" + id, null, sami.token()));
        assertTrue(avant.get("adresseLivraison").isNull(), "avant la collecte, le coursier ne connait que la zone");
        String qr = succes(200, appel("GET", "/partenaire/commandes/" + id + "/etiquette", null, partenaire)).get("contenuQr").asText();
        var apres = succes(200, appel("POST", "/livreur/missions/" + id + "/collecte", Map.of("code", qr), sami.token()));
        assertEquals("5 avenue Habib Bourguiba", apres.get("adresseLivraison").asText());
        assertEquals(latClient, apres.get("latitudeLivraison").asDouble(), 1e-9);
    }
}
