package com.fleetpulse.livraison;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;

import com.fleetpulse.livraison.Service.NotificationSender;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class Sprint1ParcoursTest {
    @LocalServerPort private int port;
    @MockitoBean private NotificationSender notifications;
    private final JsonMapper json = JsonMapper.builder().build();
    private final HttpClient client = HttpClient.newHttpClient();
    private final Map<String, String> codes = new ConcurrentHashMap<>();
    private record Reponse(int status, JsonNode data) { }

    @BeforeEach
    void capturerCodesSansLesJournaliser() {
        doAnswer(invocation -> {
            var matcher = Pattern.compile("\\b(\\d{6})\\b").matcher(invocation.<String>getArgument(1));
            if (matcher.find()) codes.put(invocation.getArgument(0), matcher.group(1));
            return null;
        }).when(notifications).envoyerSms(anyString(), anyString());
        doAnswer(invocation -> {
            var matcher = Pattern.compile("\\b(\\d{6})\\b").matcher(invocation.<String>getArgument(2));
            if (matcher.find()) codes.put(invocation.getArgument(0), matcher.group(1));
            return null;
        }).when(notifications).envoyerEmail(anyString(), anyString(), anyString());
    }
    private Reponse appel(String methode, String route, Object body, String token) throws Exception {
        var builder = HttpRequest.newBuilder(URI.create("http://localhost:" + port + route))
                .header("Content-Type", "application/json")
                .method(methode, body == null ? HttpRequest.BodyPublishers.noBody()
                        : HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)));
        if (token != null) builder.header("Authorization", "Bearer " + token);
        var r = client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
        return new Reponse(r.statusCode(), r.body().isBlank() ? null : json.readTree(r.body()));
    }
    private Reponse login(String email, String password) throws Exception {
        return appel("POST", "/api/auth/login", Map.of("email", email, "motDePasse", password), null);
    }
    private String admin() throws Exception { return login("admin@sprint1.test", "test-admin-password").data().get("token").asText(); }
    private String email() { return "parcours-" + UUID.randomUUID() + "@sprint1.test"; }
    private String telephone() { return "+216" + (10000000 + Math.abs(UUID.randomUUID().hashCode() % 89999999)); }
    private String candidat(boolean partenaire) throws Exception {
        String email = email();
        Map<String, Object> body = new HashMap<>(Map.of("nom", "Test", "prenom", "Candidat", "email", email,
                "telephone", telephone(), "motDePasse", "test-candidat-password"));
        if (partenaire) body.putAll(Map.of("nomCommerce", "Commerce de test", "categorie", "Épicerie",
                "adresse", "Tunis", "latitude", 36.8, "longitude", 10.1, "matriculeFiscal", "MF-123"));
        else body.putAll(Map.of("numeroIdentite", "CIN-123", "vehiculeDeclare", "Scooter TU-123"));
        assertEquals(201, appel("POST", "/api/auth/inscription/" + (partenaire ? "partenaire" : "livreur"), body, null).status());
        return email;
    }

    @Test
    void otpInscriptionRotationDeconnexionEtReinitialisation() throws Exception {
        String email = email(), tel = telephone();
        assertEquals(401, appel("GET", "/api/admin/comptes", null, null).status());
        assertEquals(400, appel("POST", "/api/auth/otp/demande", Map.of("telephone", "invalide"), null).status());
        assertEquals(202, appel("POST", "/api/auth/otp/demande", Map.of("telephone", tel), null).status());
        assertEquals(429, appel("POST", "/api/auth/otp/demande", Map.of("telephone", tel), null).status());
        Map<String, Object> inscription = new HashMap<>(Map.of("telephone", tel, "nom", "Test", "prenom", "Client",
                "email", email, "motDePasse", "test-client-password", "code", "invalide"));
        assertEquals(400, appel("POST", "/api/auth/otp/inscription", inscription, null).status());
        inscription.put("code", codes.get(tel));
        var session = appel("POST", "/api/auth/otp/inscription", inscription, null);
        assertEquals(201, session.status());
        String token = session.data().get("token").asText();
        assertEquals("CLIENT", appel("GET", "/api/me", null, token).data().get("role").asText());
        assertEquals(403, appel("GET", "/api/admin/comptes", null, token).status());
        var rotation = appel("POST", "/api/auth/refresh", Map.of("refreshToken", session.data().get("refreshToken").asText()), null);
        assertEquals(200, rotation.status());
        String refresh = rotation.data().get("refreshToken").asText();
        assertEquals(204, appel("POST", "/api/auth/logout", Map.of("refreshToken", refresh), null).status());
        assertEquals(401, appel("POST", "/api/auth/refresh", Map.of("refreshToken", refresh), null).status());
        var avantReset = login(email, "test-client-password");
        assertEquals(202, appel("POST", "/api/auth/mot-de-passe/oubli", Map.of("identifiant", email), null).status());
        assertEquals(202, appel("POST", "/api/auth/mot-de-passe/oubli", Map.of("identifiant", "absent@sprint1.test"), null).status());
        assertEquals(204, appel("POST", "/api/auth/mot-de-passe/reinitialiser", Map.of("identifiant", email,
                "code", codes.get(email), "nouveauMotDePasse", "test-nouveau-password"), null).status());
        assertEquals(401, login(email, "test-client-password").status());
        assertEquals(200, login(tel, "test-nouveau-password").status());
        assertEquals(401, appel("POST", "/api/auth/refresh", Map.of("refreshToken", avantReset.data().get("refreshToken").asText()), null).status());
    }

    @Test
    void candidaturesComplementValidationSuspensionEtReactivation() throws Exception {
        String admin = admin();
        for (boolean partenaire : new boolean[] { true, false }) {
            String email = candidat(partenaire);
            var session = login(email, "test-candidat-password"); assertEquals(200, session.status());
            String token = session.data().get("token").asText();
            var dossier = appel("GET", "/api/dossier", null, token).data();
            long id = dossier.get("id").asLong();
            assertEquals("EN_ATTENTE", dossier.get("statut").asText());
            assertEquals(403, appel("GET", "/api/admin/comptes", null, token).status());
            assertEquals(403, appel("GET", "/api/livraisons", null, token).status());
            assertEquals(400, appel("PUT", "/api/admin/dossiers/" + id + "/refuser", Map.of("motif", "  "), admin).status());
            assertEquals(400, appel("PUT", "/api/admin/dossiers/" + id + "/complement", Map.of("motif", ""), admin).status());
            assertEquals(200, appel("PUT", "/api/admin/dossiers/" + id + "/complement", Map.of("motif", "Vérifiez la pièce"), admin).status());
            assertEquals("COMPLEMENT_DEMANDE", appel("GET", "/api/dossier", null, token).data().get("statut").asText());
            assertEquals(200, appel("PUT", "/api/dossier", Map.of("nom", "Corrigé"), token).status());
            assertEquals(200, appel("PUT", "/api/admin/dossiers/" + id + "/valider", null, admin).status());
            assertEquals("ACTIF", appel("GET", "/api/me", null, token).data().get("statut").asText());
            assertEquals(400, appel("PUT", "/api/admin/comptes/" + id + "/suspendre", Map.of("motif", " "), admin).status());
            assertEquals(200, appel("PUT", "/api/admin/comptes/" + id + "/suspendre", Map.of("motif", "Vérification"), admin).status());
            assertEquals(403, login(email, "test-candidat-password").status());
            assertEquals(401, login(email, "mauvais-password").status());
            assertEquals(401, appel("GET", "/api/me", null, token).status());
            assertEquals(200, appel("PUT", "/api/admin/comptes/" + id + "/reactiver", Map.of("motif", "Vérification terminée"), admin).status());
            assertEquals(200, login(email, "test-candidat-password").status());
        }
    }

    @Test
    void refusResteConsultableSansAccesAuRoleEtFinanceConsulteAuditSeulement() throws Exception {
        String email = candidat(false), admin = admin();
        String token = login(email, "test-candidat-password").data().get("token").asText();
        long id = appel("GET", "/api/dossier", null, token).data().get("id").asLong();
        assertEquals(200, appel("PUT", "/api/admin/dossiers/" + id + "/refuser", Map.of("motif", "Pièce expirée"), admin).status());
        token = login(email, "test-candidat-password").data().get("token").asText();
        assertEquals("Pièce expirée", appel("GET", "/api/dossier", null, token).data().get("motifStatut").asText());
        assertEquals(403, appel("GET", "/api/admin/livreurs", null, token).status());
        assertEquals(409, appel("PUT", "/api/dossier", Map.of("nom", "Test"), token).status());
        String finance = email();
        assertEquals(201, appel("POST", "/api/admin/responsables", Map.of("nom", "Test", "prenom", "Finance",
                "email", finance, "motDePasse", "test-finance-password", "sousRole", "FINANCE"), admin).status());
        String financeToken = login(finance, "test-finance-password").data().get("token").asText();
        assertEquals(403, appel("GET", "/api/admin/comptes", null, financeToken).status());
        assertEquals(403, appel("GET", "/api/admin/livreurs", null, financeToken).status());
        var page = appel("GET", "/api/admin/audit/page?page=0&taille=1&action=COMPTE_REFUSE", null, financeToken);
        assertEquals(200, page.status()); assertEquals(1, page.data().get("content").size());
        assertTrue(page.data().get("totalElements").asLong() > 0);
        assertEquals(0, appel("GET", "/api/admin/audit/page?debut=" + Instant.now().plusSeconds(60), null, financeToken).data().get("totalElements").asLong());
        assertEquals(400, appel("GET", "/api/admin/audit/page?page=-1", null, financeToken).status());
        assertEquals(400, appel("GET", "/api/admin/audit/page?debut=invalide", null, financeToken).status());
    }
}
