package com.fleetpulse.livraison;

import static org.junit.jupiter.api.Assertions.*;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.*;
import com.fleetpulse.livraison.Repository.UtilisateurRepository;
import com.fleetpulse.livraison.Service.NotificationSender;
import java.net.URI;
import java.net.http.*;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** US-2B11 : zones de travail des coursiers, gerees par le Responsable (base H2). */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=jdbc:h2:mem:sprint2biszones;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
        "app.sprint2.donnees-demo=false" })
class Sprint2bisZonesLivreurTest {
    @LocalServerPort int port;
    @Autowired UtilisateurRepository utilisateurs;
    @Autowired PasswordEncoder encoder;
    @MockitoBean NotificationSender notifications;
    final JsonMapper json = JsonMapper.builder().build();
    final HttpClient http = HttpClient.newHttpClient();
    static final AtomicInteger sequence = new AtomicInteger();
    String admin, finance;
    long livreurId, zoneA, zoneB, zoneC;
    String nomZoneA;

    record Reponse(int status, JsonNode data) { }
    Reponse appel(String methode, String route, Object body, String token) throws Exception {
        var b = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api" + route)).header("Content-Type", "application/json")
                .method(methode, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)));
        if (token != null) b.header("Authorization", "Bearer " + token);
        var r = http.send(b.build(), HttpResponse.BodyHandlers.ofString());
        return new Reponse(r.statusCode(), r.body().isBlank() ? null : json.readTree(r.body()));
    }
    JsonNode succes(int status, Reponse r) { assertEquals(status, r.status(), String.valueOf(r.data())); return r.data(); }

    long creerZone(String nom, double latitude, double longitude) throws Exception {
        return succes(201, appel("POST", "/admin/zones", Map.of("nom", nom, "fraisLivraison", 3, "polygone", List.of(
                Map.of("latitude", latitude, "longitude", longitude), Map.of("latitude", latitude, "longitude", longitude + 1),
                Map.of("latitude", latitude + 1, "longitude", longitude + 1), Map.of("latitude", latitude + 1, "longitude", longitude))), admin))
                .get("id").asLong();
    }
    Map<String, Object> affectation(long zoneId, String type) { return new HashMap<>(Map.of("zoneId", zoneId, "type", type)); }
    String zones() { return "/admin/livreurs/" + livreurId + "/zones"; }

    @BeforeEach void preparer() throws Exception {
        int n = sequence.incrementAndGet();
        admin = succes(200, appel("POST", "/auth/login", Map.of("email", "admin@sprint1.test", "motDePasse", "test-admin-password"), null))
                .get("token").asText();
        Responsable f = new Responsable(); f.setEmail(UUID.randomUUID() + "@zones.test"); f.setNom("Finance"); f.setPrenom("Test");
        f.setRole(Role.RESPONSABLE); f.setSousRole(SousRole.FINANCE); f.setMotDePasseHash(encoder.encode("zones-password"));
        finance = succes(200, appel("POST", "/auth/login", Map.of("email", utilisateurs.save(f).getEmail(), "motDePasse", "zones-password"), null))
                .get("token").asText();
        livreurId = succes(201, appel("POST", "/admin/livreurs", Map.of("nom", "Coursier", "prenom", "Sami",
                "email", UUID.randomUUID() + "@zones.test", "motDePasse", "coursier-password"), admin)).get("id").asLong();
        double lat = 60 + n * 3;
        nomZoneA = "Zone A " + n;
        zoneA = creerZone(nomZoneA, lat, 10);
        zoneB = creerZone("Zone B " + n, lat, 12);
        zoneC = creerZone("Zone C " + n, lat, 14);
    }

    @Test void unePrincipaleParLivreurEtUneAffectationParZone() throws Exception {
        assertEquals(0, succes(200, appel("GET", zones(), null, admin)).size());
        var principale = succes(201, appel("POST", zones(), affectation(zoneA, "PRINCIPALE"), admin));
        assertEquals("PRINCIPALE", principale.get("type").asText());
        assertEquals(nomZoneA, principale.get("zoneNom").asText());
        assertTrue(principale.get("enVigueur").asBoolean());

        assertTrue(succes(409, appel("POST", zones(), affectation(zoneB, "PRINCIPALE"), admin)).get("message").asText().contains("zone principale"));
        succes(409, appel("POST", zones(), affectation(zoneA, "SECONDAIRE"), admin));
        succes(201, appel("POST", zones(), affectation(zoneB, "SECONDAIRE"), admin));

        var liste = succes(200, appel("GET", zones(), null, admin));
        assertEquals(List.of("PRINCIPALE", "SECONDAIRE"), List.of(liste.get(0).get("type").asText(), liste.get(1).get("type").asText()));
        var livreur = java.util.stream.StreamSupport.stream(succes(200, appel("GET", "/admin/livreurs", null, admin)).spliterator(), false)
                .filter(l -> l.get("id").asLong() == livreurId).findFirst().orElseThrow();
        assertEquals(nomZoneA, livreur.get("zonePrincipale").asText());

        succes(409, appel("DELETE", "/admin/zones/" + zoneA, null, admin));
        succes(204, appel("DELETE", zones() + "/" + principale.get("id").asLong(), null, admin));
        succes(201, appel("POST", zones(), affectation(zoneC, "PRINCIPALE"), admin));

        var journal = succes(200, appel("GET", "/admin/audit?action=ZONE_LIVREUR_RETIREE&cibleId=" + livreurId, null, admin));
        assertEquals(1, journal.size());
        assertTrue(journal.get(0).get("details").asText().contains(nomZoneA));
    }

    @Test void affectationTemporaireAvecPeriodeValide() throws Exception {
        Instant maintenant = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        var sansDates = affectation(zoneB, "TEMPORAIRE");
        succes(400, appel("POST", zones(), sansDates, admin));
        var inversee = affectation(zoneB, "TEMPORAIRE");
        inversee.put("debut", maintenant.plusSeconds(7200).toString()); inversee.put("fin", maintenant.plusSeconds(3600).toString());
        succes(400, appel("POST", zones(), inversee, admin));
        var passee = affectation(zoneB, "TEMPORAIRE");
        passee.put("debut", maintenant.minusSeconds(7200).toString()); passee.put("fin", maintenant.minusSeconds(3600).toString());
        succes(400, appel("POST", zones(), passee, admin));

        var future = affectation(zoneB, "TEMPORAIRE");
        future.put("debut", maintenant.plusSeconds(3600).toString()); future.put("fin", maintenant.plusSeconds(18000).toString());
        var aVenir = succes(201, appel("POST", zones(), future, admin));
        assertFalse(aVenir.get("enVigueur").asBoolean(), "renfort pas encore commencé");
        assertEquals(maintenant.plusSeconds(3600), Instant.parse(aVenir.get("debut").asText()));

        var enCours = affectation(zoneC, "TEMPORAIRE");
        enCours.put("debut", maintenant.minusSeconds(3600).toString()); enCours.put("fin", maintenant.plusSeconds(3600).toString());
        assertTrue(succes(201, appel("POST", zones(), enCours, admin)).get("enVigueur").asBoolean());

        var secondaireAvecDates = affectation(zoneA, "SECONDAIRE");
        secondaireAvecDates.put("debut", maintenant.toString()); secondaireAvecDates.put("fin", maintenant.plusSeconds(60).toString());
        var secondaire = succes(201, appel("POST", zones(), secondaireAvecDates, admin));
        assertTrue(secondaire.get("debut").isNull(), "dates ignorées hors renfort temporaire");
    }

    @Test void reserveAuxResponsablesOperations() throws Exception {
        assertEquals(403, appel("GET", zones(), null, finance).status());
        assertEquals(403, appel("POST", zones(), affectation(zoneA, "PRINCIPALE"), finance).status());
        assertEquals(401, appel("GET", zones(), null, null).status());
        succes(404, appel("GET", "/admin/livreurs/999999/zones", null, admin));
        succes(404, appel("POST", zones(), affectation(999999, "PRINCIPALE"), admin));
        succes(400, appel("POST", zones(), Map.of("zoneId", zoneA), admin));
        succes(400, appel("POST", zones(), Map.of("zoneId", zoneA, "type", "INCONNU"), admin));

        long autreLivreur = succes(201, appel("POST", "/admin/livreurs", Map.of("nom", "Autre", "prenom", "Coursier",
                "email", UUID.randomUUID() + "@zones.test", "motDePasse", "coursier-password"), admin)).get("id").asLong();
        long affectationAutre = succes(201, appel("POST", "/admin/livreurs/" + autreLivreur + "/zones", affectation(zoneA, "PRINCIPALE"), admin))
                .get("id").asLong();
        succes(404, appel("DELETE", zones() + "/" + affectationAutre, null, admin));
    }
}
