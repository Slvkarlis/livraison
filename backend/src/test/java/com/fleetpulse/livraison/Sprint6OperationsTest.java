package com.fleetpulse.livraison;

import static org.junit.jupiter.api.Assertions.*;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
    "spring.datasource.url=jdbc:h2:mem:sprint6ops;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
    "app.sprint2.donnees-demo=false", "app.commandes.intervalle-secondes=0", "app.commandes.actives-max=10" })
class Sprint6OperationsTest extends ParcoursSprint3 {
    @Test void statutsCouvertureEtFiltres() throws Exception {
        commandePrete();
        String route = "/admin/bi/operations?zoneId=" + zoneA;
        var d = succes(200, appel("GET", route, null, admin));
        assertEquals(1, d.get("zones").size());
        var zone = d.get("zones").get(0);
        assertEquals(1, zone.get("commandes").asInt());
        assertEquals(1, zone.get("commandesActives").asInt());
        assertEquals(0, zone.get("coursiersDisponibles").asInt());
        assertEquals(0, zone.get("couverturePourcent").asDouble());
        assertTrue(d.get("gainDistanceKm").isNull());
        assertEquals(1, d.get("statuts").valueStream().filter(s -> s.get("statut").asText().equals("PRETE")).findFirst().orElseThrow().get("commandes").asInt());
        coursierDisponible("Dispo BI");
        d = succes(200, appel("GET", route, null, admin));
        assertEquals(1, d.get("zones").get(0).get("coursiersDisponibles").asInt());
        assertEquals(100, d.get("zones").get(0).get("couverturePourcent").asDouble());
        var vide = succes(200, appel("GET", route + "&debut=2000-01-01&fin=2000-01-02", null, admin));
        assertEquals(0, vide.get("zones").get(0).get("commandes").asInt());
        assertEquals(1, vide.get("zones").get(0).get("commandesActives").asInt(), "couverture actuelle indépendante de la période");
        assertEquals(0, succes(200, appel("GET", "/admin/bi/operations?zoneId=999999", null, admin)).get("zones").size());
        assertEquals(400, appel("GET", "/admin/bi/operations?zoneId=-1", null, admin).status());
    }

    @Test void sousRolesVerifiesSurLeServeur() throws Exception {
        String fin = UUID.randomUUID() + "@bi.test", ops = UUID.randomUUID() + "@bi.test";
        for (var entree : Map.of(fin, "FINANCE", ops, "OPERATIONS").entrySet())
            succes(201, appel("POST", "/admin/responsables", Map.of("nom", "BI", "prenom", "Test", "email", entree.getKey(),
                    "motDePasse", "bi-test-password", "sousRole", entree.getValue()), admin));
        String finance = login(fin, "bi-test-password"), operations = login(ops, "bi-test-password");
        assertEquals(403, appel("GET", "/admin/bi/operations", null, finance).status());
        assertEquals(403, appel("GET", "/admin/finance/bi", null, operations).status());
        assertEquals(200, appel("GET", "/admin/bi/operations", null, operations).status());
        assertEquals(200, appel("GET", "/admin/finance/bi", null, finance).status());
        assertEquals(403, appel("GET", "/admin/bi/operations", null, partenaire).status());
    }
}
