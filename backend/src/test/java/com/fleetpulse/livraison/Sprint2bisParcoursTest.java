package com.fleetpulse.livraison;

import static org.junit.jupiter.api.Assertions.*;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.*;
import com.fleetpulse.livraison.Repository.*;
import com.fleetpulse.livraison.Service.NotificationSender;
import java.net.URI;
import java.net.http.*;
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

/** Parcours HTTP du Sprint 2 bis (H2) : commandes recues par le partenaire et historique des statuts. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=jdbc:h2:mem:sprint2bis;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
        "app.sprint2.donnees-demo=false", "app.commandes.intervalle-secondes=0" })
class Sprint2bisParcoursTest {
    @LocalServerPort int port;
    @Autowired UtilisateurRepository utilisateurs;
    @Autowired PasswordEncoder encoder;
    @MockitoBean NotificationSender notifications;
    final JsonMapper json = JsonMapper.builder().build();
    final HttpClient http = HttpClient.newHttpClient();
    static final AtomicInteger sequence = new AtomicInteger();
    String admin, client, partenaire, autrePartenaire, candidat;
    long partenaireId, produitId, adresseId;
    double lat;

    record Reponse(int status, JsonNode data) { }
    Reponse appel(String methode, String route, Object body, String token) throws Exception {
        var b = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api" + route)).header("Content-Type", "application/json")
                .method(methode, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)));
        if (token != null) b.header("Authorization", "Bearer " + token);
        var r = http.send(b.build(), HttpResponse.BodyHandlers.ofString());
        return new Reponse(r.statusCode(), r.body().isBlank() ? null : json.readTree(r.body()));
    }
    JsonNode succes(int status, Reponse r) { assertEquals(status, r.status(), String.valueOf(r.data())); return r.data(); }
    String login(String email) throws Exception {
        return succes(200, appel("POST", "/auth/login", Map.of("email", email, "motDePasse", "sprint2bis-password"), null)).get("token").asText();
    }
    <T extends Utilisateur> T compte(T u, Role role, String prenom) {
        u.setEmail(UUID.randomUUID() + "@sprint2bis.test"); u.setNom("Test"); u.setPrenom(prenom); u.setRole(role);
        u.setMotDePasseHash(encoder.encode("sprint2bis-password"));
        return u;
    }
    Partenaire commerce(String nom, double y, double x) {
        Partenaire p = compte(new Partenaire(), Role.PARTENAIRE, "Gérant");
        p.setNomCommerce(nom); p.setCategorie("Restaurant"); p.setAdresse("Adresse " + nom); p.setLatitude(y); p.setLongitude(x);
        return utilisateurs.save(p);
    }

    @BeforeEach void preparer() throws Exception {
        lat = 30 + sequence.incrementAndGet() * 2;
        admin = succes(200, appel("POST", "/auth/login", Map.of("email", "admin@sprint1.test", "motDePasse", "test-admin-password"), null)).get("token").asText();
        succes(201, appel("POST", "/admin/zones", Map.of("nom", "Zone " + lat, "fraisLivraison", 3.5, "polygone", List.of(
                Map.of("latitude", lat, "longitude", 10), Map.of("latitude", lat, "longitude", 11),
                Map.of("latitude", lat + 1, "longitude", 11), Map.of("latitude", lat + 1, "longitude", 10))), admin));
        Client c = utilisateurs.save(compte(new Client(), Role.CLIENT, "Amina")); client = login(c.getEmail());
        Partenaire p = commerce("Commerce A", lat + .5, 10.5); partenaireId = p.getId(); partenaire = login(p.getEmail());
        autrePartenaire = login(commerce("Commerce B", lat + .4, 10.4).getEmail());
        Partenaire attente = compte(new Partenaire(), Role.PARTENAIRE, "Candidat"); attente.setStatut(StatutCompte.EN_ATTENTE);
        candidat = login(utilisateurs.save(attente).getEmail());
        succes(200, appel("PUT", "/partenaire/commerce", Map.of("ouvert", true), partenaire));
        produitId = succes(201, appel("POST", "/partenaire/produits", Map.of("nom", "Brik", "prix", 6, "disponible", true), partenaire)).get("id").asLong();
        adresseId = succes(201, appel("POST", "/adresses", Map.of("libelle", "Maison", "adresse", "Rue privée 12", "latitude", lat + .5, "longitude", 10.5), client))
                .get("id").asLong();
    }

    long commander(int quantite, String notes) throws Exception {
        Map<String, Object> panier = new HashMap<>(Map.of("partenaireId", partenaireId, "adresseId", adresseId,
                "lignes", List.of(Map.of("produitId", produitId, "quantite", quantite)), "notes", notes));
        panier.put("devisEmpreinte", succes(200, appel("POST", "/commandes/devis", panier, client)).get("empreinte").asText());
        panier.put("cleIdempotence", UUID.randomUUID().toString());
        return succes(201, appel("POST", "/commandes", panier, client)).get("id").asLong();
    }

    @Test void lePartenaireVoitSesCommandesRecuesAvecHistorique() throws Exception {
        long premiere = commander(2, "Sans piment");
        long seconde = commander(1, "");
        var liste = succes(200, appel("GET", "/partenaire/commandes", null, partenaire));
        assertEquals(2, liste.size());
        assertEquals(seconde, liste.get(0).get("id").asLong(), "plus récente en premier");
        var resume = liste.get(1);
        assertEquals("PENDING_PARTNER", resume.get("statut").asText());
        assertEquals("Amina", resume.get("clientPrenom").asText());
        assertEquals(2, resume.get("nbArticles").asInt());
        assertEquals(15.5, resume.get("total").asDouble(), .00001);
        assertFalse(resume.has("clientEmail"));

        assertEquals(2, succes(200, appel("GET", "/partenaire/commandes?statut=PENDING_PARTNER", null, partenaire)).size());
        assertEquals(0, succes(200, appel("GET", "/partenaire/commandes?statut=PRETE&statut=ACCEPTEE", null, partenaire)).size());
        succes(400, appel("GET", "/partenaire/commandes?statut=INCONNU", null, partenaire));

        var detail = succes(200, appel("GET", "/partenaire/commandes/" + premiere, null, partenaire));
        assertEquals("Sans piment", detail.get("notes").asText());
        assertEquals("Brik", detail.get("lignes").get(0).get("nomProduit").asText());
        assertEquals(12.0, detail.get("montantArticles").asDouble(), .00001);
        assertEquals(3.5, detail.get("fraisLivraison").asDouble(), .00001);
        assertEquals("Zone " + lat, detail.get("zoneNom").asText());
        var historique = detail.get("historique");
        assertEquals(1, historique.size());
        assertTrue(historique.get(0).get("ancien").isNull());
        assertEquals("PENDING_PARTNER", historique.get(0).get("nouveau").asText());
        assertEquals("CLIENT", historique.get(0).get("acteurRole").asText());
        assertFalse(detail.toString().contains("Rue privée"), "l'adresse exacte du client n'est pas exposée au partenaire");
        assertFalse(historique.get(0).has("acteur"), "l'email de l'auteur n'est pas exposé");
    }

    @Test void commandesInvisiblesPourLesAutres() throws Exception {
        long id = commander(1, "");
        assertEquals(0, succes(200, appel("GET", "/partenaire/commandes", null, autrePartenaire)).size());
        succes(404, appel("GET", "/partenaire/commandes/" + id, null, autrePartenaire));
        succes(404, appel("GET", "/partenaire/commandes/999999", null, partenaire));
        assertEquals(403, appel("GET", "/partenaire/commandes", null, client).status());
        assertEquals(403, appel("GET", "/partenaire/commandes", null, candidat).status());
        assertEquals(401, appel("GET", "/partenaire/commandes", null, null).status());
    }

    JsonNode commandeClient(long id) throws Exception {
        for (JsonNode c : succes(200, appel("GET", "/livraisons/mes", null, client))) if (c.get("id").asLong() == id) return c;
        throw new AssertionError("commande " + id + " absente de l'historique client");
    }

    @Test void acceptationAvecTempsDePreparationPuisDecisionFigee() throws Exception {
        long id = commander(1, "");
        var c = succes(200, appel("PUT", "/partenaire/commandes/" + id + "/accepter", Map.of("tempsPreparationMinutes", 15), partenaire));
        assertEquals("ACCEPTEE", c.get("statut").asText());
        assertEquals(15, c.get("tempsPreparationMinutes").asInt());
        assertFalse(c.get("accepteeLe").isNull());
        var historique = c.get("historique");
        assertEquals(2, historique.size());
        assertEquals("PENDING_PARTNER", historique.get(1).get("ancien").asText());
        assertEquals("ACCEPTEE", historique.get(1).get("nouveau").asText());
        assertEquals("PARTENAIRE", historique.get(1).get("acteurRole").asText());
        assertTrue(historique.get(1).get("motif").asText().contains("15 min"));

        var rejeu = succes(200, appel("PUT", "/partenaire/commandes/" + id + "/accepter", Map.of("tempsPreparationMinutes", 40), partenaire));
        assertEquals(15, rejeu.get("tempsPreparationMinutes").asInt(), "un double clic ne change pas le temps annoncé");
        assertEquals(2, rejeu.get("historique").size());
        assertEquals("ETAT_INVALIDE", succes(409, appel("PUT", "/partenaire/commandes/" + id + "/refuser", Map.of("motif", "RUPTURE"), partenaire))
                .get("code").asText());

        var vueClient = commandeClient(id);
        assertEquals("ACCEPTEE", vueClient.get("statut").asText());
        assertEquals(15, vueClient.get("tempsPreparationMinutes").asInt());
        assertEquals(1, succes(200, appel("GET", "/partenaire/commandes?statut=ACCEPTEE", null, partenaire)).size());
    }

    @Test void refusMotiveVisibleParLeClient() throws Exception {
        long id = commander(1, "");
        String route = "/partenaire/commandes/" + id + "/refuser";
        succes(400, appel("PUT", route, Map.of(), partenaire));
        succes(400, appel("PUT", route, Map.of("motif", "AUTRE"), partenaire));
        succes(400, appel("PUT", route, Map.of("motif", "AUTRE", "commentaire", "   "), partenaire));
        succes(400, appel("PUT", route, Map.of("motif", "INCONNU"), partenaire));
        succes(400, appel("PUT", route, Map.of("motif", "RUPTURE", "commentaire", "x".repeat(301)), partenaire));

        var c = succes(200, appel("PUT", route, Map.of("motif", "RUPTURE", "commentaire", " Plus de brik "), partenaire));
        assertEquals("REFUSEE", c.get("statut").asText());
        assertEquals("RUPTURE", c.get("motifRefus").asText());
        assertEquals("Plus de brik", c.get("commentaireRefus").asText());
        assertEquals("Rupture de stock : Plus de brik", c.get("historique").get(1).get("motif").asText());
        assertEquals(2, succes(200, appel("PUT", route, Map.of("motif", "FERMETURE"), partenaire)).get("historique").size());
        succes(409, appel("PUT", "/partenaire/commandes/" + id + "/accepter", Map.of("tempsPreparationMinutes", 10), partenaire));

        var vueClient = commandeClient(id);
        assertEquals("REFUSEE", vueClient.get("statut").asText());
        assertEquals("RUPTURE", vueClient.get("motifRefus").asText());
        assertEquals("Plus de brik", vueClient.get("commentaireRefus").asText());
    }

    @Test void decisionValideeEtReserveeAuPartenaireDeLaCommande() throws Exception {
        long id = commander(1, "");
        String route = "/partenaire/commandes/" + id + "/accepter";
        succes(400, appel("PUT", route, Map.of(), partenaire));
        succes(400, appel("PUT", route, Map.of("tempsPreparationMinutes", 0), partenaire));
        succes(400, appel("PUT", route, Map.of("tempsPreparationMinutes", 181), partenaire));
        succes(404, appel("PUT", route, Map.of("tempsPreparationMinutes", 10), autrePartenaire));
        succes(404, appel("PUT", "/partenaire/commandes/" + id + "/refuser", Map.of("motif", "RUPTURE"), autrePartenaire));
        assertEquals(403, appel("PUT", route, Map.of("tempsPreparationMinutes", 10), client).status());
        assertEquals(403, appel("PUT", route, Map.of("tempsPreparationMinutes", 10), candidat).status());
        assertEquals("PENDING_PARTNER", commandeClient(id).get("statut").asText(), "aucun appel refusé n'a modifié la commande");
    }
}
