package com.fleetpulse.livraison;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.junit.jupiter.api.Assertions.*;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.*;
import com.fleetpulse.livraison.Repository.UtilisateurRepository;
import com.fleetpulse.livraison.Service.NotificationSender;
import java.lang.reflect.Type;
import java.net.URI;
import java.net.http.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.messaging.converter.JacksonJsonMessageConverter;
import org.springframework.messaging.simp.stomp.*;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Temps reel du Sprint 2 bis (US-2B1) : vrai client STOMP sur /ws, base H2. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=jdbc:h2:mem:sprint2bistr;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
        "app.sprint2.donnees-demo=false", "app.commandes.intervalle-secondes=0" })
class Sprint2bisTempsReelTest {
    @LocalServerPort int port;
    @Autowired UtilisateurRepository utilisateurs;
    @Autowired PasswordEncoder encoder;
    @MockitoBean NotificationSender notifications;
    final JsonMapper json = JsonMapper.builder().build();
    final HttpClient http = HttpClient.newHttpClient();
    static final AtomicInteger sequence = new AtomicInteger();
    final List<StompSession> sessions = new ArrayList<>();
    String client, partenaire, autrePartenaire;
    long partenaireId, produitId, adresseId;

    JsonNode appel(int attendu, String methode, String route, Object body, String token) throws Exception {
        var b = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api" + route)).header("Content-Type", "application/json")
                .method(methode, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)));
        if (token != null) b.header("Authorization", "Bearer " + token);
        var r = http.send(b.build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(attendu, r.statusCode(), r.body());
        return r.body().isBlank() ? null : json.readTree(r.body());
    }
    String login(String email, String motDePasse) throws Exception {
        return appel(200, "POST", "/auth/login", Map.of("email", email, "motDePasse", motDePasse), null).get("token").asText();
    }
    <T extends Utilisateur> T compte(T u, Role role) {
        u.setEmail(UUID.randomUUID() + "@temps-reel.test"); u.setNom("Test"); u.setPrenom("Temps"); u.setRole(role);
        u.setMotDePasseHash(encoder.encode("temps-reel-password"));
        return utilisateurs.save(u);
    }
    Partenaire commerce(String nom, double y, double x) {
        Partenaire p = new Partenaire(); p.setNomCommerce(nom); p.setCategorie("Restaurant"); p.setAdresse(nom); p.setLatitude(y); p.setLongitude(x);
        return compte(p, Role.PARTENAIRE);
    }

    @BeforeEach void preparer() throws Exception {
        double lat = 50 + sequence.incrementAndGet() * 2;
        String admin = login("admin@sprint1.test", "test-admin-password");
        appel(201, "POST", "/admin/zones", Map.of("nom", "Zone TR " + lat, "fraisLivraison", 2, "polygone", List.of(
                Map.of("latitude", lat, "longitude", 10), Map.of("latitude", lat, "longitude", 11),
                Map.of("latitude", lat + 1, "longitude", 11), Map.of("latitude", lat + 1, "longitude", 10))), admin);
        client = login(compte(new Client(), Role.CLIENT).getEmail(), "temps-reel-password");
        Partenaire p = commerce("Commerce TR", lat + .5, 10.5); partenaireId = p.getId();
        partenaire = login(p.getEmail(), "temps-reel-password");
        autrePartenaire = login(commerce("Autre TR", lat + .4, 10.4).getEmail(), "temps-reel-password");
        appel(200, "PUT", "/partenaire/commerce", Map.of("ouvert", true), partenaire);
        produitId = appel(201, "POST", "/partenaire/produits", Map.of("nom", "Brik", "prix", 6, "disponible", true), partenaire).get("id").asLong();
        adresseId = appel(201, "POST", "/adresses", Map.of("libelle", "Maison", "adresse", "Rue", "latitude", lat + .5, "longitude", 10.5), client)
                .get("id").asLong();
    }
    @AfterEach void fermer() { sessions.forEach(s -> { if (s.isConnected()) s.disconnect(); }); }

    long commander() throws Exception {
        Map<String, Object> panier = new HashMap<>(Map.of("partenaireId", partenaireId, "adresseId", adresseId,
                "lignes", List.of(Map.of("produitId", produitId, "quantite", 1)), "notes", ""));
        panier.put("devisEmpreinte", appel(200, "POST", "/commandes/devis", panier, client).get("empreinte").asText());
        panier.put("cleIdempotence", UUID.randomUUID().toString());
        return appel(201, "POST", "/commandes", panier, client).get("id").asLong();
    }

    WebSocketStompClient stomp() {
        var c = new WebSocketStompClient(new StandardWebSocketClient());
        c.setMessageConverter(new JacksonJsonMessageConverter());
        var planificateur = new ThreadPoolTaskScheduler(); planificateur.initialize(); c.setTaskScheduler(planificateur);
        return c;
    }
    CompletableFuture<StompSession> connecter(String token, StompSessionHandler handler) {
        var entetes = new StompHeaders(); entetes.add("Authorization", "Bearer " + token);
        return stomp().connectAsync("ws://localhost:" + port + "/ws", new WebSocketHttpHeaders(), entetes, handler);
    }
    /** Connecte et s'abonne a /user/queue/commandes. */
    BlockingQueue<Map<String, Object>> ecouter(String token) throws Exception {
        StompSession session = connecter(token, new StompSessionHandlerAdapter() { }).get(5, SECONDS);
        sessions.add(session);
        BlockingQueue<Map<String, Object>> recus = new LinkedBlockingQueue<>();
        session.subscribe("/user/queue/commandes", new StompFrameHandler() {
            @Override public Type getPayloadType(StompHeaders h) { return Map.class; }
            @SuppressWarnings("unchecked") @Override public void handleFrame(StompHeaders h, Object p) { recus.add((Map<String, Object>) p); }
        });
        // Le broker simple n'envoie pas d'accuse RECEIPT pour un SUBSCRIBE : courte attente avant de declencher les evenements.
        Thread.sleep(300);
        return recus;
    }
    static void attendre(BlockingQueue<Map<String, Object>> recus, long id, String ancien, String nouveau) throws InterruptedException {
        Map<String, Object> m = recus.poll(5, SECONDS);
        assertNotNull(m, "aucun message " + nouveau + " reçu");
        assertEquals(id, ((Number) m.get("commandeId")).longValue());
        assertEquals(ancien, m.get("ancien"));
        assertEquals(nouveau, m.get("nouveau"));
    }

    @Test void partenaireEtClientRecoiventLesChangementsDeLeurCommande() throws Exception {
        var recusPartenaire = ecouter(partenaire);
        var recusClient = ecouter(client);
        var recusAutre = ecouter(autrePartenaire);

        long id = commander();
        attendre(recusPartenaire, id, null, "PENDING_PARTNER");
        attendre(recusClient, id, null, "PENDING_PARTNER");

        appel(200, "PUT", "/partenaire/commandes/" + id + "/accepter", Map.of("tempsPreparationMinutes", 10), partenaire);
        attendre(recusPartenaire, id, "PENDING_PARTNER", "ACCEPTEE");
        attendre(recusClient, id, "PENDING_PARTNER", "ACCEPTEE");

        appel(200, "PUT", "/partenaire/commandes/" + id + "/preparation/temps", Map.of("tempsPreparationMinutes", 5), partenaire);
        attendre(recusClient, id, "ACCEPTEE", "ACCEPTEE");

        assertNull(recusAutre.poll(500, TimeUnit.MILLISECONDS), "un autre commerce ne reçoit rien");
    }

    @Test void connexionSansJetonValideRefusee() throws Exception {
        CompletableFuture<String> refus = new CompletableFuture<>();
        var futur = connecter("jeton-invalide", new StompSessionHandlerAdapter() {
            @Override public void handleFrame(StompHeaders h, Object p) { refus.complete("ERROR"); }
            @Override public void handleTransportError(StompSession s, Throwable e) { refus.complete("transport"); }
        });
        assertNotNull(refus.get(5, SECONDS));
        assertFalse(futur.isDone() && !futur.isCompletedExceptionally() && futur.get().isConnected(), "session non établie");
    }

    @Test void abonnementHorsDeSesFilesRefuse() throws Exception {
        CompletableFuture<String> refus = new CompletableFuture<>();
        StompSession session = connecter(partenaire, new StompSessionHandlerAdapter() {
            @Override public void handleFrame(StompHeaders h, Object p) { refus.complete("ERROR"); }
            @Override public void handleTransportError(StompSession s, Throwable e) { refus.complete("transport"); }
        }).get(5, SECONDS);
        sessions.add(session);
        session.subscribe("/queue/commandes", new StompSessionHandlerAdapter() { });
        assertNotNull(refus.get(5, SECONDS), "le serveur refuse l'abonnement à une file non personnelle");
    }
}
