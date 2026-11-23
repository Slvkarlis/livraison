package com.fleetpulse.livraison;

import static org.junit.jupiter.api.Assertions.*;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.*;
import com.fleetpulse.livraison.Repository.UtilisateurRepository;
import com.fleetpulse.livraison.Service.NotificationSender;
import java.net.URI;
import java.net.http.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Base des scenarios HTTP du Sprint 3 : une zone, un commerce, un client, et les etapes du First Mile
 * (commande prete, coursier disponible, collecte) pour arriver vite au Last Mile.
 * Chaque sous-classe declare @SpringBootTest avec sa propre base H2.
 */
abstract class ParcoursSprint3 {
    @LocalServerPort int port;
    @Autowired UtilisateurRepository utilisateurs;
    @Autowired PasswordEncoder encoder;
    @MockitoBean NotificationSender notifications;
    final JsonMapper json = JsonMapper.builder().build();
    final HttpClient http = HttpClient.newHttpClient();
    static final AtomicInteger sequence = new AtomicInteger();

    String admin, client, autreClient, partenaire;
    String clientEmail;
    long zoneA, partenaireId, produitId, adresseId;
    /** Commerce au centre de la zone ; client a ~5,5 km au nord ; un point hors de toute zone. */
    double latCommerce, lngCommerce, latClient, lngClient;
    Map<String, Object> dansA;

    record Reponse(int status, JsonNode data) { }
    record Coursier(long id, String token) { }

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
    Coursier coursier(String prenom) throws Exception {
        String email = UUID.randomUUID() + "@sprint3.test";
        long id = succes(201, appel("POST", "/admin/livreurs", Map.of("nom", "Test", "prenom", prenom, "email", email,
                "motDePasse", "coursier-password"), admin)).get("id").asLong();
        return new Coursier(id, login(email, "coursier-password"));
    }
    /** Coursier affecte a la zone A (principale) et disponible au commerce. */
    Coursier coursierDisponible(String prenom) throws Exception {
        Coursier c = coursier(prenom);
        succes(201, appel("POST", "/admin/livreurs/" + c.id() + "/zones", Map.of("zoneId", zoneA, "type", "PRINCIPALE"), admin));
        Map<String, Object> corps = new HashMap<>(dansA);
        corps.put("disponible", true);
        succes(200, appel("PUT", "/livreur/disponibilite", corps, c.token()));
        return c;
    }
    /** Nouveau client actif : son email (mot de passe client-password). */
    String nouveauClient(String prenom, String telephone) {
        Client c = new Client(); c.setEmail(UUID.randomUUID() + "@sprint3.test"); c.setNom("Test"); c.setPrenom(prenom);
        c.setTelephone(telephone);
        c.setRole(Role.CLIENT); c.setMotDePasseHash(encoder.encode("client-password"));
        return utilisateurs.save(c).getEmail();
    }

    /** Commande passee (2 x 6 DT + 3 DT de frais = 15 DT), acceptee 10 min, puis prete : detail partenaire. */
    JsonNode commandePrete() throws Exception {
        Map<String, Object> panier = new HashMap<>(Map.of("partenaireId", partenaireId, "adresseId", adresseId,
                "lignes", List.of(Map.of("produitId", produitId, "quantite", 2)), "notes", ""));
        panier.put("devisEmpreinte", succes(200, appel("POST", "/commandes/devis", panier, client)).get("empreinte").asText());
        panier.put("cleIdempotence", UUID.randomUUID().toString());
        long id = succes(201, appel("POST", "/commandes", panier, client)).get("id").asLong();
        succes(200, appel("PUT", "/partenaire/commandes/" + id + "/accepter", Map.of("tempsPreparationMinutes", 10), partenaire));
        return succes(200, appel("PUT", "/partenaire/commandes/" + id + "/prete", null, partenaire));
    }
    /** Commande prete, affectee a c puis collectee par scan : id de la commande. */
    long commandeCollectee(Coursier c) throws Exception {
        long id = commandePrete().get("id").asLong();
        String qr = succes(200, appel("GET", "/partenaire/commandes/" + id + "/etiquette", null, partenaire)).get("contenuQr").asText();
        assertEquals("RECUPEREE", succes(200, appel("POST", "/livreur/missions/" + id + "/collecte", Map.of("code", qr), c.token()))
                .get("statut").asText());
        return id;
    }
    Reponse position(Coursier c, double lat, double lng) throws Exception {
        return appel("PUT", "/livreur/position", Map.of("latitude", lat, "longitude", lng), c.token());
    }
    JsonNode commandeClient(long id) throws Exception {
        return StreamSupport.stream(succes(200, appel("GET", "/livraisons/mes", null, client)).spliterator(), false)
                .filter(l -> l.get("id").asLong() == id).findFirst().orElseThrow();
    }

    @BeforeEach void preparerSprint3() throws Exception {
        double lat = 10 + (sequence.incrementAndGet() % 35) * 2;   // reste dans les bornes geographiques
        admin = login("admin@sprint1.test", "test-admin-password");
        zoneA = creerZone("Zone S3 " + lat, lat, 20);
        latCommerce = lat + .5; lngCommerce = 20.5;
        latClient = lat + .55; lngClient = 20.5;
        dansA = Map.of("latitude", latCommerce, "longitude", lngCommerce);

        clientEmail = nouveauClient("Amina", "+21620000001");
        client = login(clientEmail, "client-password");
        autreClient = login(nouveauClient("Autre", null), "client-password");
        Partenaire p = new Partenaire(); p.setEmail(UUID.randomUUID() + "@sprint3.test"); p.setNom("Test"); p.setPrenom("Gerant");
        p.setRole(Role.PARTENAIRE); p.setMotDePasseHash(encoder.encode("partenaire-password"));
        p.setNomCommerce("Commerce S3"); p.setCategorie("Restaurant"); p.setAdresse("1 rue du Port");
        p.setLatitude(latCommerce); p.setLongitude(lngCommerce);
        partenaireId = utilisateurs.save(p).getId();
        partenaire = login(p.getEmail(), "partenaire-password");
        succes(200, appel("PUT", "/partenaire/commerce", Map.of("ouvert", true), partenaire));
        produitId = succes(201, appel("POST", "/partenaire/produits", Map.of("nom", "Brik", "prix", 6, "disponible", true), partenaire)).get("id").asLong();
        adresseId = succes(201, appel("POST", "/adresses", Map.of("libelle", "Maison", "adresse", "5 avenue Habib Bourguiba",
                "latitude", latClient, "longitude", lngClient), client)).get("id").asLong();
    }
}
