package com.fleetpulse.livraison.Service;

import static org.junit.jupiter.api.Assertions.*;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/** Client du service d'IA : contrat JSON et mode degrade (aucune exception, reponse vide). */
class ServiceIaTest {
    HttpServer serveur;
    final AtomicReference<String> recu = new AtomicReference<>();

    String demarrer(int statut, String reponse) throws Exception {
        serveur = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        serveur.createContext("/", echange -> {
            recu.set(echange.getRequestURI().getPath() + " " + new String(echange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] corps = reponse.getBytes(StandardCharsets.UTF_8);
            echange.sendResponseHeaders(statut, corps.length);
            echange.getResponseBody().write(corps);
            echange.close();
        });
        serveur.start();
        return "http://127.0.0.1:" + serveur.getAddress().getPort() + "/";
    }

    @AfterEach void arreter() { if (serveur != null) serveur.stop(0); }

    final ServiceIa.CaracteristiquesEta eta = new ServiceIa.CaracteristiquesEta(3L, 10, 1.8, 20, 12, 2, 1);

    @Test void sansUrlLesReglesS_appliquent() {
        ServiceIa ia = new ServiceIa("", 800);
        assertFalse(ia.actif());
        assertTrue(ia.predireEta(eta).isEmpty());
    }

    @Test void predictionLueEtChampsInconnusIgnores() throws Exception {
        ServiceIa ia = new ServiceIa(demarrer(200, "{\"preparationMin\":12.5,\"trajetMin\":6,\"modele\":\"gbr\",\"version\":3}"), 2000);
        var p = ia.predireEta(eta).orElseThrow();
        assertEquals(12.5, p.preparationMin());
        assertEquals("gbr", p.modele());
        assertTrue(recu.get().startsWith("/v1/eta "));
        assertTrue(recu.get().contains("\"preparationAnnonceeMin\":10"));
    }

    @Test void reponseIncoherenteOuErreurDonnentLeModeDegrade() throws Exception {
        ServiceIa ia = new ServiceIa(demarrer(200, "{\"preparationMin\":-4,\"trajetMin\":6}"), 2000);
        assertTrue(ia.predireEta(eta).isEmpty(), "duree negative ecartee");
        arreter();
        ia = new ServiceIa(demarrer(500, "{}"), 2000);
        assertTrue(ia.predireEta(eta).isEmpty());
        arreter();
        ia = new ServiceIa(demarrer(200, "pas du json"), 2000);
        assertTrue(ia.proposerLots(new ServiceIa.DemandeLots(List.of(), Map.of(), 1.5, 20, 35)).isEmpty());
    }

    @Test void serviceInjoignable() {
        ServiceIa ia = new ServiceIa("http://127.0.0.1:1", 200);
        assertTrue(ia.actif());
        assertTrue(ia.predireEta(eta).isEmpty());
    }

    @Test void lotsProposes() throws Exception {
        ServiceIa ia = new ServiceIa(demarrer(200, "{\"lots\":[{\"commandes\":[1,2],\"itineraire\":[\"C:1\",\"C:2\",\"L:1\",\"L:2\"]}],\"moteur\":\"exact\"}"), 2000);
        var r = ia.proposerLots(new ServiceIa.DemandeLots(List.of(), Map.of("2", List.of(3L)), 1.5, 20, 35)).orElseThrow();
        assertEquals(List.of(1L, 2L), r.lots().getFirst().commandes());
        assertEquals("exact", r.moteur());
        assertTrue(recu.get().startsWith("/v1/lots "));
    }
}
