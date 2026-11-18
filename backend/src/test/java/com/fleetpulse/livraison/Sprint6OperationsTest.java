package com.fleetpulse.livraison;

import static org.junit.jupiter.api.Assertions.*;
import com.fleetpulse.livraison.Model.enums.*;
import com.fleetpulse.livraison.Repository.LivraisonRepository;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
    "spring.datasource.url=jdbc:h2:mem:sprint6ops;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
    "app.sprint2.donnees-demo=false", "app.commandes.intervalle-secondes=0", "app.commandes.actives-max=10" })
class Sprint6OperationsTest extends ParcoursSprint3 {
    @Autowired LivraisonRepository commandes;

    @Test void preparationsDecisionsMotifsNotesEtClassement() throws Exception {
        long id = commandePrete().get("id").asLong();
        var acceptee = commandes.findById(id).orElseThrow();
        acceptee.setAccepteeLe(Instant.now().minusSeconds(720)); acceptee.setPreteLe(acceptee.getAccepteeLe().plusSeconds(720));
        acceptee.setStatut(StatutLivraison.LIVREE); acceptee.setLivreeLe(Instant.now()); commandes.save(acceptee);
        long autre = commandePrete().get("id").asLong();
        var refusee = commandes.findById(autre).orElseThrow();
        refusee.setAccepteeLe(null); refusee.setPreteLe(null); refusee.setTempsPreparationMinutes(null);
        refusee.setStatut(StatutLivraison.REFUSEE); refusee.setMotifRefus(MotifRefus.RUPTURE); commandes.save(refusee);
        succes(201, appel("POST", "/commandes/" + id + "/notations", Map.of("cible", "PARTENAIRE", "note", 5), client));
        var d = succes(200, appel("GET", "/admin/bi/partenaires?zoneId=" + zoneA, null, admin));
        var p = d.get("partenaires").get(0);
        assertEquals(2, p.get("commandes").asInt()); assertEquals(1, p.get("acceptees").asInt()); assertEquals(1, p.get("refusees").asInt());
        assertEquals(50, p.get("tauxAcceptation").asDouble()); assertEquals(50, p.get("tauxRefus").asDouble());
        assertEquals(10, p.get("preparationEstimeeMinutes").asDouble()); assertEquals(12, p.get("preparationReelleMinutes").asDouble());
        assertEquals(1, p.get("preparationsMesurees").asInt()); assertEquals(5, p.get("noteMoyenne").asDouble());
        assertEquals(1, p.get("nombreNotes").asInt()); assertEquals(1, p.get("classement").asInt());
        assertEquals("RUPTURE", p.get("motifs").get(0).get("motif").asText());
        assertTrue(p.get("tauxExpiration").isNull()); assertTrue(p.get("reclamations").isNull());
        assertEquals(0, succes(200, appel("GET", "/admin/bi/partenaires?zoneId=" + zoneA + "&debut=2000-01-01&fin=2000-01-02", null, admin)).get("partenaires").size());
    }
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
        assertEquals(403, appel("GET", "/admin/bi/partenaires", null, finance).status());
        assertEquals(403, appel("GET", "/admin/bi/coursiers", null, finance).status());
        assertEquals(403, appel("GET", "/admin/finance/bi", null, operations).status());
        assertEquals(403, appel("GET", "/admin/finance/bi/alertes", null, operations).status());
        assertEquals(403, appel("GET", "/admin/finance/bi/seuils", null, operations).status());
        assertEquals(403, appel("GET", "/admin/bi/alertes", null, finance).status());
        assertEquals(403, appel("GET", "/admin/bi/seuils", null, finance).status());
        assertEquals(200, appel("GET", "/admin/bi/operations", null, operations).status());
        assertEquals(200, appel("GET", "/admin/finance/bi", null, finance).status());
        assertEquals(403, appel("GET", "/admin/bi/operations", null, partenaire).status());
    }
}
