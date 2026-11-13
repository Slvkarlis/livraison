package com.fleetpulse.livraison;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.junit.jupiter.api.Assertions.*;
import com.fleetpulse.livraison.Model.Livreur;
import com.fleetpulse.livraison.Repository.LivreurRepository;
import java.lang.reflect.Type;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.messaging.converter.JacksonJsonMessageConverter;
import org.springframework.messaging.simp.stomp.*;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;

/** US-302 / US-303 : le client suit le coursier sur la carte, avec une ETA par regles (base H2). */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=jdbc:h2:mem:sprint3suivi;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
        "app.sprint2.donnees-demo=false", "app.commandes.intervalle-secondes=0", "app.commandes.actives-max=10" })
class Sprint3SuiviTest extends ParcoursSprint3 {
    @Autowired LivreurRepository livreurs;
    final List<StompSession> sessions = new ArrayList<>();

    // Le serveur peut fermer la session entre isConnected() et disconnect() (abonnement refuse) : rien a fermer alors
    @AfterEach void fermer() {
        sessions.forEach(s -> { try { if (s.isConnected()) s.disconnect(); } catch (org.springframework.messaging.MessageDeliveryException deja) { } });
    }

    /** Le point precedent date d'une heure : le prochain envoi, meme lointain, n'est pas un saut GPS. */
    void vieillirPosition(Coursier c) {
        Livreur l = livreurs.findById(c.id()).orElseThrow();
        l.setDernierePositionLe(Instant.now().minusSeconds(3600));
        livreurs.save(l);
    }

    @Test void etaAvantLaCollecteSansPositionDuCoursier() throws Exception {
        long id = commandePrete().get("id").asLong();   // aucun coursier : la commande attend, PRETE
        var suivi = succes(200, appel("GET", "/commandes/" + id + "/suivi", null, client));
        assertEquals("PRETE", suivi.get("statut").asText());
        assertTrue(suivi.get("livreur").isNull());
        assertEquals(latClient, suivi.get("destination").get("latitude").asDouble(), 1e-9);
        assertEquals(latCommerce, suivi.get("commerce").get("latitude").asDouble(), 1e-9);
        // 5,56 km x 1,3 a 20 km/h = 21,7 min, + 2 min de collecte, la preparation etant deja terminee
        long minutes = (Instant.parse(suivi.get("arriveeEstimee").asText()).getEpochSecond() - Instant.now().getEpochSecond()) / 60;
        assertTrue(minutes >= 22 && minutes <= 24, "ETA en minutes : " + minutes);

        succes(404, appel("GET", "/commandes/" + id + "/suivi", null, autreClient));
        assertEquals(403, appel("GET", "/commandes/" + id + "/suivi", null, partenaire).status());
    }

    @Test void positionVisibleApresLaCollecteEtProximiteUneSeuleFois() throws Exception {
        Coursier sami = coursierDisponible("Sami");
        long id = commandePrete().get("id").asLong();
        assertTrue(succes(200, appel("GET", "/commandes/" + id + "/suivi", null, client)).get("livreur").isNull(),
                "avant la collecte, le client ne voit pas la position du coursier");

        String qr = succes(200, appel("GET", "/partenaire/commandes/" + id + "/etiquette", null, partenaire)).get("contenuQr").asText();
        succes(200, appel("POST", "/livreur/missions/" + id + "/collecte", Map.of("code", qr), sami.token()));
        vieillirPosition(sami);
        succes(200, position(sami, latClient - .01, lngClient));   // ~1,1 km du client
        var enRoute = succes(200, appel("GET", "/commandes/" + id + "/suivi", null, client));
        assertEquals("RECUPEREE", enRoute.get("statut").asText());
        assertEquals("Sami", enRoute.get("livreurPrenom").asText());
        assertEquals(latClient - .01, enRoute.get("livreur").get("latitude").asDouble(), 1e-9);
        Instant etaLoin = Instant.parse(enRoute.get("arriveeEstimee").asText());

        vieillirPosition(sami);
        succes(200, position(sami, latClient - .002, lngClient));   // ~220 m
        var proche = succes(200, appel("GET", "/commandes/" + id + "/suivi", null, client));
        assertEquals("A_PROXIMITE", proche.get("statut").asText());
        assertTrue(Instant.parse(proche.get("arriveeEstimee").asText()).isBefore(etaLoin), "l'ETA se rapproche");

        vieillirPosition(sami);
        assertTrue(succes(200, position(sami, latClient - .001, lngClient)).get("acceptee").asBoolean());
        var historique = succes(200, appel("GET", "/commandes/" + id + "/historique", null, client));
        long alertes = java.util.stream.StreamSupport.stream(historique.spliterator(), false)
                .filter(h -> "A_PROXIMITE".equals(h.get("nouveau").asText())).count();
        assertEquals(1, alertes, "une seule alerte de proximité");
        assertEquals("A_PROXIMITE", succes(200, appel("GET", "/livreur/missions/" + id, null, sami.token())).get("statut").asText(),
                "la mission reste en cours jusqu'à la remise");
    }

    @Test void positionPousseeAuClientEnTempsReel() throws Exception {
        Coursier sami = coursierDisponible("Sami");
        long id = commandeCollectee(sami);
        var stomp = new WebSocketStompClient(new StandardWebSocketClient());
        stomp.setMessageConverter(new JacksonJsonMessageConverter());
        var planificateur = new ThreadPoolTaskScheduler(); planificateur.initialize(); stomp.setTaskScheduler(planificateur);
        var entetes = new StompHeaders(); entetes.add("Authorization", "Bearer " + client);
        StompSession session = stomp.connectAsync("ws://localhost:" + port + "/ws", new WebSocketHttpHeaders(), entetes,
                new StompSessionHandlerAdapter() { }).get(5, SECONDS);
        sessions.add(session);
        BlockingQueue<Map<String, Object>> recus = new LinkedBlockingQueue<>();
        session.subscribe("/user/queue/positions", new StompFrameHandler() {
            @Override public Type getPayloadType(StompHeaders h) { return Map.class; }
            @SuppressWarnings("unchecked") @Override public void handleFrame(StompHeaders h, Object p) { recus.add((Map<String, Object>) p); }
        });
        Thread.sleep(300);

        succes(200, position(sami, latCommerce + .0002, lngCommerce));
        Map<String, Object> message = recus.poll(5, SECONDS);
        assertNotNull(message, "position non reçue par le client");
        assertEquals(id, ((Number) message.get("commandeId")).longValue());
        assertEquals(latCommerce + .0002, ((Number) message.get("latitude")).doubleValue(), 1e-9);
        assertNotNull(message.get("arriveeEstimee"));
    }

    @Test void vitesseMoyenneDeLaZone() throws Exception {
        var zones = succes(200, appel("GET", "/admin/zones", null, admin));
        var zone = java.util.stream.StreamSupport.stream(zones.spliterator(), false).filter(z -> z.get("id").asLong() == zoneA).findFirst().orElseThrow();
        assertEquals(20, zone.get("vitesseMoyenneKmh").asDouble(), 1e-9, "valeur par défaut");

        Map<String, Object> corps = new HashMap<>(Map.of("nom", zone.get("nom").asText(), "fraisLivraison", 3,
                "polygone", json.treeToValue(zone.get("polygone"), List.class)));
        corps.put("vitesseMoyenneKmh", 200);
        succes(400, appel("PUT", "/admin/zones/" + zoneA, corps, admin));
        corps.put("vitesseMoyenneKmh", 40);
        assertEquals(40, succes(200, appel("PUT", "/admin/zones/" + zoneA, corps, admin)).get("vitesseMoyenneKmh").asDouble(), 1e-9);

        long id = commandePrete().get("id").asLong();
        long minutes = (Instant.parse(succes(200, appel("GET", "/commandes/" + id + "/suivi", null, client)).get("arriveeEstimee").asText())
                .getEpochSecond() - Instant.now().getEpochSecond()) / 60;
        assertTrue(minutes >= 12 && minutes <= 13, "deux fois plus rapide : " + minutes + " min");
    }
}
