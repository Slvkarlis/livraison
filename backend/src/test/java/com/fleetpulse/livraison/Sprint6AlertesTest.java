package com.fleetpulse.livraison;

import static org.junit.jupiter.api.Assertions.*;
import com.fleetpulse.livraison.Model.enums.*;
import com.fleetpulse.livraison.Repository.LivraisonRepository;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import tools.jackson.databind.JsonNode;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
    "spring.datasource.url=jdbc:h2:mem:sprint6alertes;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
    "app.sprint2.donnees-demo=false", "app.commandes.intervalle-secondes=0", "app.commandes.actives-max=10" })
class Sprint6AlertesTest extends ParcoursSprint3 {
    @Autowired LivraisonRepository commandes;

    JsonNode seuil(String type, Object valeur, boolean actif) throws Exception {
        String base = type.equals("CASH_COURSIER") ? "/admin/finance/bi" : "/admin/bi";
        return succes(200, appel("PUT", base + "/seuils/" + type, Map.of("valeur", valeur, "actif", actif), admin));
    }
    List<JsonNode> alertes(boolean finance) throws Exception {
        return succes(200, appel("GET", finance ? "/admin/finance/bi/alertes" : "/admin/bi/alertes", null, admin)).valueStream().toList();
    }

    @Test void cashDeclencheSansDoublonSeResoutEtSeReactiveAvecAudit() throws Exception {
        Coursier coursier = coursierDisponible("Cash BI");
        long id = commandeCollectee(coursier);
        String qr = succes(200, appel("GET", "/commandes/" + id + "/qr-remise", null, client)).get("contenuQr").asText();
        succes(200, appel("POST", "/livreur/missions/" + id + "/remise", Map.of("montantEncaisse", 15, "preuve", qr), coursier.token()));
        seuil("CASH_COURSIER", 10, true);
        JsonNode a = alertes(true).stream().filter(v -> v.get("objetId").asLong() == coursier.id()).findFirst().orElseThrow();
        assertEquals(15, a.get("valeur").asDouble()); assertEquals(10, a.get("seuil").asDouble());
        JsonNode seconde = alertes(true).stream().filter(v -> v.get("objetId").asLong() == coursier.id()).findFirst().orElseThrow();
        assertEquals(a.get("id"), seconde.get("id")); assertEquals(a.get("declencheeLe"), seconde.get("declencheeLe"));
        seuil("CASH_COURSIER", 15, true); assertTrue(alertes(true).stream().noneMatch(v -> v.get("objetId").asLong() == coursier.id()), "égalité sans dépassement");
        seuil("CASH_COURSIER", 10, true);
        assertEquals(a.get("id"), alertes(true).stream().filter(v -> v.get("objetId").asLong() == coursier.id()).findFirst().orElseThrow().get("id"));
        succes(201, appel("POST", "/admin/finance/depots", Map.of("livreurId", coursier.id(), "montantRecu", 15, "cleIdempotence", UUID.randomUUID().toString()), admin));
        assertTrue(alertes(true).stream().noneMatch(v -> v.get("objetId").asLong() == coursier.id()));
        var audit = succes(200, appel("GET", "/admin/audit/page?action=SEUIL_ALERTE_MODIFIE", null, admin));
        assertTrue(audit.get("totalElements").asInt() >= 3);
        assertTrue(audit.get("content").get(0).get("details").asText().contains("CASH_COURSIER"));
        for (String valeur : List.of("-1", "1000001", "1.2345"))
            assertEquals(400, appel("PUT", "/admin/finance/bi/seuils/CASH_COURSIER", Map.of("valeur", valeur, "actif", true), admin).status());
        assertEquals(400, appel("PUT", "/admin/bi/seuils/COUVERTURE_ZONE", Map.of("valeur", 101, "actif", true), admin).status());
        assertEquals(403, appel("PUT", "/admin/bi/seuils/CASH_COURSIER", Map.of("valeur", 5, "actif", true), admin).status());
        assertEquals(403, appel("PUT", "/admin/finance/bi/seuils/RETARD_ETA", Map.of("valeur", 5, "actif", true), admin).status());
        assertEquals(403, appel("GET", "/admin/bi/seuils", null, client).status());
    }

    @Test void alertesOperationsMesurentAttenteEtaCouvertureEtRefus() throws Exception {
        long id = commandePrete().get("id").asLong();
        var attente = commandes.findById(id).orElseThrow();
        attente.setPreteLe(Instant.now().minusSeconds(3600)); attente.setPromesseLivraison(Instant.now().minusSeconds(1800)); commandes.save(attente);
        Set<String> types = new HashSet<>();
        for (JsonNode a : alertes(false)) if (a.get("objetId").asLong() == zoneA || a.get("objetId").asLong() == id) types.add(a.get("type").asText());
        assertTrue(types.containsAll(Set.of("COUVERTURE_ZONE", "ABSENCE_COURSIER", "RETARD_ETA")), types.toString());
        for (int i = 0; i < 5; i++) {
            long refus = commandePrete().get("id").asLong(); var c = commandes.findById(refus).orElseThrow();
            c.setAccepteeLe(null); c.setPreteLe(null); c.setStatut(StatutLivraison.REFUSEE); c.setMotifRefus(MotifRefus.RUPTURE); commandes.save(c);
        }
        assertTrue(alertes(false).stream().anyMatch(a -> a.get("type").asText().equals("TAUX_REFUS_PARTENAIRE") && a.get("objetId").asLong() == partenaireId));
        seuil("ABSENCE_COURSIER", 15, false);
        assertTrue(alertes(false).stream().noneMatch(a -> a.get("type").asText().equals("ABSENCE_COURSIER")));
        seuil("ABSENCE_COURSIER", 15, true);
    }
}
