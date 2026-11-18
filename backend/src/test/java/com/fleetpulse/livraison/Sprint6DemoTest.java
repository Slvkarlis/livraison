package com.fleetpulse.livraison;

import static org.junit.jupiter.api.Assertions.*;
import com.fleetpulse.livraison.Repository.*;
import com.fleetpulse.livraison.Service.Sprint6DemoInitializer;
import java.net.URI;
import java.net.http.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.ActiveProfiles;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@ActiveProfiles("demo")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
    "spring.datasource.url=jdbc:h2:mem:sprint6demo;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
    "app.demo.enabled=true", "app.sprint6.donnees-demo=true", "app.sprint2.donnees-demo=false" })
class Sprint6DemoTest {
    @LocalServerPort int port;
    @Autowired LivraisonRepository commandes;
    @Autowired FinanceCommandeRepository finances;
    @Autowired PartenaireRepository partenaires;
    @Autowired LivreurRepository livreurs;
    @Autowired ZoneRepository zones;
    @Autowired NotationRepository notes;
    @Autowired Sprint6DemoInitializer demo;
    @Autowired BiRepository agregats;
    final HttpClient http = HttpClient.newHttpClient();
    final JsonMapper json = JsonMapper.builder().build();

    JsonNode appel(String methode, String chemin, Object corps, String token, int attendu) throws Exception {
        var r = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api" + chemin)).header("Content-Type", "application/json");
        if (token != null) r.header("Authorization", "Bearer " + token);
        var reponse = http.send(r.method(methode, corps == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(json.writeValueAsString(corps))).build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(attendu, reponse.statusCode(), reponse.body());
        return json.readTree(reponse.body());
    }
    String login(String email, String mdp) throws Exception { return appel("POST", "/auth/login", Map.of("email", email, "motDePasse", mdp), null, 200).get("token").asText(); }

    @Test void demonstrationCompleteIdempotenteEtDashboardsSous500msAuP95() throws Exception {
        assertEquals(36, commandes.count()); assertEquals(30, finances.count()); assertEquals(2, partenaires.count());
        assertEquals(3, livreurs.count()); assertEquals(2, zones.count()); assertEquals(112, notes.count());
        demo.initialiser(); assertEquals(36, commandes.count()); assertEquals(112, notes.count());
        String admin = login("admin@sprint1.test", "test-admin-password");
        String client = login("client@sprint6.demo", "demo-sprint6-password");
        String partenaire = login("partenaire2@sprint6.demo", "demo-sprint6-password");
        String coursier = login("coursier3@sprint6.demo", "demo-sprint6-password");
        Object[] livraison = agregats.lignes("select c.id, c.partenaire.id, c.livreur.id from Livraison c where c.codeSuivi = 'DEMO-S6-30'", Map.of()).getFirst();
        String route = "/commandes/" + livraison[0] + "/notations";
        appel("POST", route, Map.of("cible", "PARTENAIRE", "note", 5), client, 201);
        appel("POST", route, Map.of("cible", "LIVREUR", "note", 4), client, 201);
        appel("POST", route, Map.of("cible", "CLIENT", "note", 5), coursier, 201);
        appel("POST", route, Map.of("cible", "LIVREUR", "note", 5), partenaire, 201);
        assertEquals(116, notes.count());
        var classement = appel("GET", "/admin/bi/partenaires", null, admin, 200);
        var partenaireBi = classement.get("partenaires").valueStream().filter(p -> p.get("id").asLong() == ((Number) livraison[1]).longValue()).findFirst().orElseThrow();
        assertEquals(15, partenaireBi.get("nombreNotes").asInt());
        assertEquals(notes.moyenne(((Number) livraison[1]).longValue()), partenaireBi.get("noteMoyenne").asDouble(), .001);
        appel("PUT", "/admin/finance/bi/seuils/CASH_COURSIER", Map.of("valeur", 1800, "actif", true), admin, 200);
        var alertes = appel("GET", "/admin/finance/bi/alertes", null, admin, 200);
        assertTrue(alertes.valueStream().anyMatch(a -> a.get("objetId").asLong() == ((Number) livraison[2]).longValue() && a.get("valeur").asDouble() == 1830));
        var ventes = appel("GET", "/partenaire/ventes", null, partenaire, 200);
        assertEquals(1800, ventes.get("chiffreAffaires").asDouble()); assertEquals(15, ventes.get("commandes").asInt());
        for (String endpoint : List.of("/admin/finance/bi", "/admin/bi/operations", "/admin/bi/partenaires", "/admin/bi/coursiers", "/partenaire/ventes")) {
            String token = endpoint.contains("/partenaire/") ? partenaire : admin;
            for (int i = 0; i < 5; i++) appel("GET", endpoint, null, token, 200);
            List<Double> temps = new ArrayList<>();
            for (int i = 0; i < 30; i++) {
                long debut = System.nanoTime(); appel("GET", endpoint, null, token, 200);
                temps.add((System.nanoTime() - debut) / 1_000_000.0);
            }
            Collections.sort(temps); double p95 = temps.get((int) Math.ceil(temps.size() * .95) - 1);
            System.out.printf(java.util.Locale.ROOT, "BI_P95 %s %.3f ms (H2, HTTP, 30 mesures, 5 chauffes)%n", endpoint, p95);
            assertTrue(p95 < 500, endpoint + " p95=" + p95 + " ms");
        }
    }
}
