package com.fleetpulse.livraison;

import static org.junit.jupiter.api.Assertions.*;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.*;
import com.fleetpulse.livraison.Repository.UtilisateurRepository;
import com.fleetpulse.livraison.Service.NotificationSender;
import java.net.URI;
import java.net.http.*;
import java.time.Instant;
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

/** US-2B8 : disponibilite des coursiers dans leurs zones et affectation simple des commandes pretes (base H2). */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=jdbc:h2:mem:sprint2bismissions;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
        "app.sprint2.donnees-demo=false", "app.commandes.intervalle-secondes=0", "app.commandes.actives-max=10" })
class Sprint2bisMissionsTest {
    @LocalServerPort int port;
    @Autowired UtilisateurRepository utilisateurs;
    @Autowired PasswordEncoder encoder;
    @MockitoBean NotificationSender notifications;
    final JsonMapper json = JsonMapper.builder().build();
    final HttpClient http = HttpClient.newHttpClient();
    static final AtomicInteger sequence = new AtomicInteger();

    String admin, client, partenaire;
    long zoneA, zoneB, partenaireId, produitId, adresseId;
    /** Positions : centre de la zone A, centre de la zone B, et un point couvert par aucune zone. */
    Map<String, Object> dansA, dansB, horsZones;

    record Reponse(int status, JsonNode data) { }
    Reponse appel(String methode, String route, Object body, String token) throws Exception {
        var b = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api" + route)).header("Content-Type", "application/json")
                .method(methode, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)));
        if (token != null) b.header("Authorization", "Bearer " + token);
        var r = http.send(b.build(), HttpResponse.BodyHandlers.ofString());
        return new Reponse(r.statusCode(), r.body().isBlank() ? null : json.readTree(r.body()));
    }
    JsonNode succes(int status, Reponse r) { assertEquals(status, r.status(), String.valueOf(r.data())); return r.data(); }
    String login(String email, String motDePasse) throws Exception {
        return succes(200, appel("POST", "/auth/login", Map.of("email", email, "motDePasse", motDePasse), null)).get("token").asText();
    }

    long creerZone(String nom, double lat, double lng) throws Exception {
        return succes(201, appel("POST", "/admin/zones", Map.of("nom", nom, "fraisLivraison", 3, "polygone", List.of(
                Map.of("latitude", lat, "longitude", lng), Map.of("latitude", lat, "longitude", lng + 1),
                Map.of("latitude", lat + 1, "longitude", lng + 1), Map.of("latitude", lat + 1, "longitude", lng))), admin)).get("id").asLong();
    }
    record Coursier(long id, String token) { }
    Coursier coursier(String prenom) throws Exception {
        String email = UUID.randomUUID() + "@missions.test";
        long id = succes(201, appel("POST", "/admin/livreurs", Map.of("nom", "Test", "prenom", prenom, "email", email,
                "motDePasse", "coursier-password"), admin)).get("id").asLong();
        return new Coursier(id, login(email, "coursier-password"));
    }
    void affecterZone(Coursier c, long zoneId, String type) throws Exception {
        succes(201, appel("POST", "/admin/livreurs/" + c.id() + "/zones", Map.of("zoneId", zoneId, "type", type), admin));
    }
    Reponse disponible(Coursier c, Map<String, Object> position) throws Exception {
        Map<String, Object> corps = new HashMap<>(position);
        corps.put("disponible", true);
        return appel("PUT", "/livreur/disponibilite", corps, c.token());
    }
    /** Commande passee, acceptee puis marquee prete : renvoie le detail partenaire. */
    JsonNode commandePrete() throws Exception {
        Map<String, Object> panier = new HashMap<>(Map.of("partenaireId", partenaireId, "adresseId", adresseId,
                "lignes", List.of(Map.of("produitId", produitId, "quantite", 2)), "notes", ""));
        panier.put("devisEmpreinte", succes(200, appel("POST", "/commandes/devis", panier, client)).get("empreinte").asText());
        panier.put("cleIdempotence", UUID.randomUUID().toString());
        long id = succes(201, appel("POST", "/commandes", panier, client)).get("id").asLong();
        succes(200, appel("PUT", "/partenaire/commandes/" + id + "/accepter", Map.of("tempsPreparationMinutes", 10), partenaire));
        return succes(200, appel("PUT", "/partenaire/commandes/" + id + "/prete", null, partenaire));
    }

    @BeforeEach void preparer() throws Exception {
        double lat = 20 + sequence.incrementAndGet() * 3;
        admin = login("admin@sprint1.test", "test-admin-password");
        zoneA = creerZone("Zone A " + lat, lat, 30);
        zoneB = creerZone("Zone B " + lat, lat, 31);   // adjacente a A
        dansA = Map.of("latitude", lat + .5, "longitude", 30.5);
        dansB = Map.of("latitude", lat + .5, "longitude", 31.5);
        horsZones = Map.of("latitude", lat + .5, "longitude", 35.5);

        Client c = new Client(); c.setEmail(UUID.randomUUID() + "@missions.test"); c.setNom("Test"); c.setPrenom("Amina");
        c.setRole(Role.CLIENT); c.setMotDePasseHash(encoder.encode("client-password"));
        client = login(utilisateurs.save(c).getEmail(), "client-password");
        Partenaire p = new Partenaire(); p.setEmail(UUID.randomUUID() + "@missions.test"); p.setNom("Test"); p.setPrenom("Gerant");
        p.setRole(Role.PARTENAIRE); p.setMotDePasseHash(encoder.encode("partenaire-password"));
        p.setNomCommerce("Commerce A"); p.setCategorie("Restaurant"); p.setAdresse("12 rue du Marché"); p.setLatitude(lat + .5); p.setLongitude(30.5);
        partenaireId = utilisateurs.save(p).getId();
        partenaire = login(p.getEmail(), "partenaire-password");
        succes(200, appel("PUT", "/partenaire/commerce", Map.of("ouvert", true), partenaire));
        produitId = succes(201, appel("POST", "/partenaire/produits", Map.of("nom", "Brik", "prix", 6, "disponible", true), partenaire)).get("id").asLong();
        adresseId = succes(201, appel("POST", "/adresses", Map.of("libelle", "Maison", "adresse", "Rue", "latitude", lat + .5, "longitude", 30.5), client))
                .get("id").asLong();
    }

    @Test void disponibleSeulementDepuisUneZoneAutorisee() throws Exception {
        Coursier sami = coursier("Sami");
        var initiale = succes(200, appel("GET", "/livreur/disponibilite", null, sami.token()));
        assertFalse(initiale.get("disponible").asBoolean());
        assertEquals(0, initiale.get("zones").size());
        assertTrue(succes(409, disponible(sami, dansA)).get("message").asText().contains("Aucune zone"));

        affecterZone(sami, zoneA, "PRINCIPALE");
        succes(400, appel("PUT", "/livreur/disponibilite", Map.of("disponible", true), sami.token()));
        assertTrue(succes(409, disponible(sami, dansB)).get("message").asText().contains("hors de vos zones"));
        succes(409, disponible(sami, horsZones));

        var ok = succes(200, disponible(sami, dansA));
        assertTrue(ok.get("disponible").asBoolean());
        assertEquals("PRINCIPALE", ok.get("zones").get(0).get("type").asText());
        assertFalse(succes(200, appel("PUT", "/livreur/disponibilite", Map.of("disponible", false), sami.token()))
                .get("disponible").asBoolean());
    }

    @Test void unRenfortNAutoriseQuePendantSaPeriode() throws Exception {
        Coursier sami = coursier("Sami");
        affecterZone(sami, zoneA, "PRINCIPALE");
        Instant maintenant = Instant.now();
        succes(201, appel("POST", "/admin/livreurs/" + sami.id() + "/zones", Map.of("zoneId", zoneB, "type", "TEMPORAIRE",
                "debut", maintenant.plusSeconds(3600).toString(), "fin", maintenant.plusSeconds(7200).toString()), admin));
        succes(409, disponible(sami, dansB));
        succes(200, disponible(sami, dansA));
    }

    @Test void commandePreteAffecteeAuCoursierDisponibleDeLaZone() throws Exception {
        Coursier sami = coursier("Sami");
        Coursier autre = coursier("Karim");
        affecterZone(sami, zoneA, "PRINCIPALE");
        succes(200, disponible(sami, dansA));

        var commande = commandePrete();
        long id = commande.get("id").asLong();
        assertEquals("AFFECTEE", commande.get("statut").asText());
        assertEquals("Sami", commande.get("livreurPrenom").asText());
        var derniere = commande.get("historique").get(commande.get("historique").size() - 1);
        assertEquals("LIVREUR", derniere.get("acteurRole").asText());
        assertEquals("Affectation automatique : Sami", derniere.get("motif").asText());

        var missions = succes(200, appel("GET", "/livreur/missions", null, sami.token()));
        assertEquals(1, missions.size());
        var mission = missions.get(0);
        assertEquals("Commerce A", mission.get("nomCommerce").asText());
        assertEquals("12 rue du Marché", mission.get("adresseCommerce").asText());
        assertEquals("Amina", mission.get("clientPrenom").asText());
        assertEquals(2, mission.get("nbArticles").asInt());
        assertFalse(mission.has("adresse"), "l'adresse du client n'est pas utile pour la collecte");
        succes(200, appel("GET", "/livreur/missions/" + id, null, sami.token()));
        succes(404, appel("GET", "/livreur/missions/" + id, null, autre.token()));

        var vueClient = java.util.stream.StreamSupport.stream(succes(200, appel("GET", "/livraisons/mes", null, client)).spliterator(), false)
                .filter(l -> l.get("id").asLong() == id).findFirst().orElseThrow();
        assertEquals("AFFECTEE", vueClient.get("statut").asText());
        assertEquals("Sami", vueClient.get("livreurPrenom").asText());
        succes(200, appel("GET", "/partenaire/commandes/" + id + "/etiquette", null, partenaire));
    }

    @Test void zonePrincipalePrioritaireEtCommandeEnAttenteSansCoursier() throws Exception {
        Coursier secondaire = coursier("Second");
        Coursier principal = coursier("Principal");
        affecterZone(secondaire, zoneA, "SECONDAIRE");
        affecterZone(principal, zoneA, "PRINCIPALE");
        succes(200, disponible(secondaire, dansA));
        succes(200, disponible(principal, dansA));
        assertEquals("Principal", commandePrete().get("livreurPrenom").asText());

        succes(200, appel("PUT", "/livreur/disponibilite", Map.of("disponible", false), secondaire.token()));
        succes(200, appel("PUT", "/livreur/disponibilite", Map.of("disponible", false), principal.token()));
        var enAttente = commandePrete();
        assertEquals("PRETE", enAttente.get("statut").asText(), "aucun coursier disponible : la commande attend");
        assertTrue(enAttente.get("livreurPrenom").isNull());

        succes(200, disponible(secondaire, dansA));
        var missions = succes(200, appel("GET", "/livreur/missions", null, secondaire.token()));
        assertEquals(enAttente.get("id").asLong(), missions.get(0).get("id").asLong(), "affectée dès qu'un coursier se déclare disponible");
    }

    @Test void auPlusTroisMissionsParCoursier() throws Exception {
        Coursier sami = coursier("Sami");
        affecterZone(sami, zoneA, "PRINCIPALE");
        succes(200, disponible(sami, dansA));
        for (int i = 0; i < 3; i++) assertEquals("AFFECTEE", commandePrete().get("statut").asText());
        assertEquals("PRETE", commandePrete().get("statut").asText());
        assertEquals(3, succes(200, appel("GET", "/livreur/missions", null, sami.token())).size());
    }

    @Test void espaceReserveAuxCoursiers() throws Exception {
        assertEquals(403, appel("GET", "/livreur/missions", null, client).status());
        assertEquals(403, appel("PUT", "/livreur/disponibilite", Map.of("disponible", false), partenaire).status());
        assertEquals(401, appel("GET", "/livreur/disponibilite", null, null).status());
    }

    // ---------- US-2B9 : collecte du colis par scan du QR ----------

    JsonNode etiquette(long commandeId) throws Exception {
        return succes(200, appel("GET", "/partenaire/commandes/" + commandeId + "/etiquette", null, partenaire));
    }
    Reponse collecter(Coursier c, long commandeId, String code) throws Exception {
        return appel("POST", "/livreur/missions/" + commandeId + "/collecte", Map.of("code", code), c.token());
    }

    @Test void collecteParScanDuQrDuBonColis() throws Exception {
        Coursier sami = coursier("Sami");
        Coursier autre = coursier("Karim");
        affecterZone(sami, zoneA, "PRINCIPALE");
        succes(200, disponible(sami, dansA));
        long id = commandePrete().get("id").asLong();
        long autreCommande = commandePrete().get("id").asLong();
        String qr = etiquette(id).get("contenuQr").asText();

        assertTrue(succes(400, collecter(sami, id, "AAAAAA")).get("message").asText().contains("incorrect"));
        assertTrue(succes(400, collecter(sami, id, etiquette(autreCommande).get("contenuQr").asText()))
                .get("message").asText().contains("autre commande"), "QR d'un autre colis refusé");
        succes(404, collecter(autre, id, qr));

        var recuperee = succes(200, collecter(sami, id, qr));
        assertEquals("RECUPEREE", recuperee.get("statut").asText());
        assertFalse(recuperee.get("recupereeLe").isNull());
        assertEquals(recuperee.get("recupereeLe").asText(), succes(200, collecter(sami, id, qr)).get("recupereeLe").asText(),
                "rejouer la collecte ne change rien");

        var vuePartenaire = succes(200, appel("GET", "/partenaire/commandes/" + id, null, partenaire));
        assertEquals("RECUPEREE", vuePartenaire.get("statut").asText());
        var derniere = vuePartenaire.get("historique").get(vuePartenaire.get("historique").size() - 1);
        assertEquals("LIVREUR", derniere.get("acteurRole").asText());
        assertEquals("Colis scanné à la boutique", derniere.get("motif").asText());
        succes(409, appel("GET", "/partenaire/commandes/" + id + "/etiquette", null, partenaire));
        assertEquals("RECUPEREE", succes(200, appel("GET", "/livreur/missions/" + id, null, sami.token())).get("statut").asText());
    }

    @Test void collecteParSaisieManuelleDuCode() throws Exception {
        Coursier sami = coursier("Sami");
        affecterZone(sami, zoneA, "PRINCIPALE");
        succes(200, disponible(sami, dansA));
        long id = commandePrete().get("id").asLong();
        String code = etiquette(id).get("codeCollecte").asText();
        String saisie = code.substring(0, 3).toLowerCase() + " " + code.substring(3).toLowerCase();
        assertEquals("RECUPEREE", succes(200, collecter(sami, id, saisie)).get("statut").asText());
        var vueClient = java.util.stream.StreamSupport.stream(succes(200, appel("GET", "/livraisons/mes", null, client)).spliterator(), false)
                .filter(l -> l.get("id").asLong() == id).findFirst().orElseThrow();
        assertEquals("RECUPEREE", vueClient.get("statut").asText());
        assertFalse(vueClient.get("recupereeLe").isNull());
    }
}
