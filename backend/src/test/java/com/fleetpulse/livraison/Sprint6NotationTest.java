package com.fleetpulse.livraison;

import static org.junit.jupiter.api.Assertions.*;
import com.fleetpulse.livraison.Repository.NotationRepository;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
    "spring.datasource.url=jdbc:h2:mem:sprint6notes;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
    "app.sprint2.donnees-demo=false", "app.commandes.intervalle-secondes=0", "app.commandes.actives-max=10" })
class Sprint6NotationTest extends ParcoursSprint3 {
    @Autowired NotationRepository notes;

    long livrer(Coursier coursier) throws Exception {
        long id = commandeCollectee(coursier);
        String qr = succes(200, appel("GET", "/commandes/" + id + "/qr-remise", null, client)).get("contenuQr").asText();
        succes(200, appel("POST", "/livreur/missions/" + id + "/remise", Map.of("montantEncaisse", 15, "preuve", qr), coursier.token()));
        return id;
    }

    @Test void clientNoteSesParticipantsUneSeuleFoisApresLivraison() throws Exception {
        Coursier coursier = coursierDisponible("Sami");
        long id = commandeCollectee(coursier);
        String route = "/commandes/" + id + "/notations";
        assertEquals(409, appel("POST", route, Map.of("cible", "PARTENAIRE", "note", 4), client).status());
        assertEquals(403, appel("GET", route, null, autreClient).status());
        assertEquals(403, appel("POST", route, Map.of("cible", "PARTENAIRE", "note", 5), autreClient).status());
        String qr = succes(200, appel("GET", "/commandes/" + id + "/qr-remise", null, client)).get("contenuQr").asText();
        succes(200, appel("POST", "/livreur/missions/" + id + "/remise", Map.of("montantEncaisse", 15, "preuve", qr), coursier.token()));
        for (int invalide : new int[]{0, 6})
            assertEquals(400, appel("POST", route, Map.of("cible", "PARTENAIRE", "note", invalide), client).status());
        assertEquals(400, appel("POST", route, Map.of("cible", "PARTENAIRE", "note", 2.5), client).status());
        assertEquals(400, appel("POST", route, Map.of("cible", "PARTENAIRE", "note", 4, "commentaire", "x".repeat(501)), client).status());
        assertEquals(403, appel("POST", route, Map.of("cible", "CLIENT", "note", 4), client).status());
        succes(201, appel("POST", route, Map.of("cible", "PARTENAIRE", "note", 4, "commentaire", "Très bien"), client));
        assertEquals(409, appel("POST", route, Map.of("cible", "PARTENAIRE", "note", 1), client).status());
        assertEquals(405, appel("PUT", route, Map.of("cible", "PARTENAIRE", "note", 1), client).status());
        succes(201, appel("POST", route, Map.of("cible", "LIVREUR", "note", 5), client));
        var vue = succes(200, appel("GET", route, null, client));
        assertEquals(2, vue.get("notes").size());
        assertEquals(4.0, notes.moyenne(partenaireId));
        long autre = livrer(coursier);
        succes(201, appel("POST", "/commandes/" + autre + "/notations", Map.of("cible", "PARTENAIRE", "note", 2), client));
        assertEquals(3.0, notes.moyenne(partenaireId));
    }

    @Test void notesCroiseesEtConfidentialiteDesAvis() throws Exception {
        Coursier coursier = coursierDisponible("Nour");
        long id = livrer(coursier);
        String route = "/commandes/" + id + "/notations";
        succes(201, appel("POST", route, Map.of("cible", "CLIENT", "note", 3), coursier.token()));
        assertEquals(409, appel("POST", route, Map.of("cible", "CLIENT", "note", 4), coursier.token()).status());
        succes(201, appel("POST", route, Map.of("cible", "LIVREUR", "note", 4), partenaire));
        assertEquals(403, appel("POST", route, Map.of("cible", "CLIENT", "note", 4), partenaire).status());
        assertEquals(403, appel("POST", route, Map.of("cible", "PARTENAIRE", "note", 4), coursier.token()).status());
        Coursier autre = coursier("Autre");
        assertEquals(1, succes(200, appel("GET", "/livreur/missions/livrees", null, coursier.token())).size());
        assertEquals(0, succes(200, appel("GET", "/livreur/missions/livrees", null, autre.token())).size());
        assertEquals(403, appel("POST", route, Map.of("cible", "CLIENT", "note", 1), autre.token()).status());
        assertEquals(403, appel("GET", route, null, admin).status());
        assertEquals(0, succes(200, appel("GET", route, null, client)).get("notes").size());
        assertEquals(1, succes(200, appel("GET", route, null, partenaire)).get("notes").size());
    }
}
