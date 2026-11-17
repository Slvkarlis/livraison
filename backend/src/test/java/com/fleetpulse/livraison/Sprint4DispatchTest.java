package com.fleetpulse.livraison;

import static org.junit.jupiter.api.Assertions.*;
import com.fleetpulse.livraison.Repository.OffreLotRepository;
import java.time.Instant;
import java.util.*;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import tools.jackson.databind.JsonNode;

/**
 * Sprint 4 (base H2, dispatch par lots active) : offre au coursier (US-405), lot de 2 collectes (US-403, US-404),
 * debordement hors zone (US-402), promesse (US-406), supervision et affectation forcee (US-407), entrepot (US-401).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=jdbc:h2:mem:sprint4dispatch;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
        "app.sprint2.donnees-demo=false", "app.commandes.intervalle-secondes=0", "app.commandes.actives-max=10",
        "app.dispatch.par-lots=true", "app.dispatch.planificateur=false", "app.dispatch.fenetre-regroupement-secondes=0",
        "app.dispatch.delai-offre-secondes=60" })
class Sprint4DispatchTest extends ParcoursSprint3 {
    @Autowired OffreLotRepository offresEnBase;

    JsonNode offres(Coursier c) throws Exception { return succes(200, appel("GET", "/livreur/offres", null, c.token())); }
    JsonNode missions(Coursier c) throws Exception { return succes(200, appel("GET", "/livreur/missions", null, c.token())); }
    Reponse accepter(Coursier c, long offre) throws Exception { return appel("PUT", "/livreur/offres/" + offre + "/accepter", null, c.token()); }
    Reponse refuser(Coursier c, long offre) throws Exception {
        return appel("PUT", "/livreur/offres/" + offre + "/refuser", Map.of("motif", "Pneu crevé"), c.token());
    }
    static List<JsonNode> liste(JsonNode tableau) { return StreamSupport.stream(tableau.spliterator(), false).toList(); }
    static JsonNode parId(JsonNode tableau, long id) {
        return liste(tableau).stream().filter(n -> n.get("id").asLong() == id).findFirst().orElseThrow();
    }

    @Test void offreAccepteePuisCollecteEtRemiseAvecPromesseEtEntrepot() throws Exception {
        Coursier sami = coursierDisponible("Sami");
        JsonNode prete = commandePrete();
        long id = prete.get("id").asLong();
        assertEquals("PRETE", prete.get("statut").asText(), "le coursier doit d'abord accepter l'offre");
        assertEquals(0, missions(sami).size());

        JsonNode offre = offres(sami).get(0);
        assertEquals(1, offre.get("nbCommandes").asInt());
        assertFalse(offre.get("horsZone").asBoolean());
        assertEquals(15.0, offre.get("montantACollecter").asDouble(), 1e-9);
        assertEquals("COLLECTE", offre.get("etapes").get(0).get("type").asText());
        assertEquals("LIVRAISON", offre.get("etapes").get(1).get("type").asText());
        assertTrue(offre.get("etapes").get(1).get("latitude").isNull(), "adresse du client masquee avant la collecte");

        long offreId = offre.get("id").asLong();
        JsonNode lot = succes(200, accepter(sami, offreId));
        assertEquals("ACCEPTE", lot.get("statut").asText());
        assertEquals(id, lot.get("commandes").get(0).asLong());
        assertEquals("ACCEPTE", succes(200, accepter(sami, offreId)).get("statut").asText(), "rejeu sans effet");
        assertEquals("AFFECTEE", missions(sami).get(0).get("statut").asText());
        assertEquals(1, succes(200, appel("GET", "/livreur/lots", null, sami.token())).size());
        assertEquals(0, offres(sami).size());

        // US-406 : promesse figee a l'acceptation par le commerce, regles sans service d'IA
        JsonNode suivi = succes(200, appel("GET", "/commandes/" + id + "/suivi", null, client));
        Instant promesse = Instant.parse(suivi.get("promesseLivraison").asText());
        assertTrue(promesse.isAfter(Instant.now()));
        assertEquals("REGLES", suivi.get("sourcePromesse").asText());
        assertEquals(promesse, Instant.parse(succes(200, appel("GET", "/commandes/" + id + "/suivi", null, client))
                .get("promesseLivraison").asText()), "la promesse ne bouge plus");

        String etiquette = succes(200, appel("GET", "/partenaire/commandes/" + id + "/etiquette", null, partenaire)).get("contenuQr").asText();
        assertEquals("RECUPEREE", succes(200, appel("POST", "/livreur/missions/" + id + "/collecte", Map.of("code", etiquette), sami.token()))
                .get("statut").asText());
        String qr = succes(200, appel("GET", "/commandes/" + id + "/qr-remise", null, client)).get("contenuQr").asText();
        assertEquals("LIVREE", succes(200, appel("POST", "/livreur/missions/" + id + "/remise",
                Map.of("montantEncaisse", 15, "preuve", qr), sami.token())).get("statut").asText());

        // US-401 : statuts, preparation, offre et affectation historises ; une ligne d'entrainement de l'ETA
        List<JsonNode> evenements = liste(succes(200, appel("GET", "/admin/entrepot/evenements?limite=5000", null, admin))).stream()
                .filter(e -> e.get("commandeId").asLong() == id).toList();
        Set<String> codes = new HashSet<>(), types = new HashSet<>();
        evenements.forEach(e -> { codes.add(e.get("code").asText()); types.add(e.get("type").asText()); });
        assertTrue(codes.containsAll(Set.of("PRETE", "AFFECTEE", "RECUPEREE", "LIVREE", "PROPOSEE", "ACCEPTEE", "ANNONCE_10")), codes.toString());
        assertTrue(types.containsAll(Set.of("STATUT", "PREPARATION", "OFFRE", "AFFECTATION")), types.toString());
        JsonNode echantillon = liste(succes(200, appel("GET", "/admin/entrepot/jeu-eta", null, admin))).stream()
                .filter(e -> e.get("commandeId").asLong() == id).findFirst().orElseThrow();
        assertEquals(10, echantillon.get("preparationAnnonceeMin").asInt());
        assertFalse(echantillon.get("trajetReelMin").isNull());
        assertEquals(403, appel("GET", "/admin/entrepot/evenements", null, client).status());
    }

    @Test void refusRepropositionPuisCommandeEnAttenteEnSupervision() throws Exception {
        Coursier sami = coursierDisponible("Sami"), nour = coursierDisponible("Nour");
        long id = commandePrete().get("id").asLong();
        JsonNode os = offres(sami), on = offres(nour);
        assertEquals(1, os.size() + on.size(), "une seule offre a la fois pour un lot");
        Coursier premier = os.size() == 1 ? sami : nour, second = premier == sami ? nour : sami;
        long offre1 = (os.size() == 1 ? os : on).get(0).get("id").asLong();

        assertEquals(204, refuser(premier, offre1).status());
        assertEquals(0, offres(premier).size());
        long offre2 = offres(second).get(0).get("id").asLong();
        assertEquals(404, accepter(premier, offre2).status(), "offre d'un autre livreur");
        assertEquals(409, accepter(premier, offre1).status(), "offre deja refusee");
        assertEquals(204, refuser(second, offre2).status());

        JsonNode supervision = succes(200, appel("GET", "/admin/dispatch", null, admin));
        assertTrue(supervision.get("parLots").asBoolean());
        JsonNode attente = parId(supervision.get("enAttente"), id);
        assertTrue(attente.get("offre").isNull(), "plus aucun livreur disponible n'a vu cette commande");
        JsonNode lot = parId(supervision.get("lots"), attente.get("lotId").asLong());
        assertEquals(List.of("REFUSEE", "REFUSEE"), liste(lot.get("offres")).stream().map(o -> o.get("statut").asText()).toList());
        assertEquals(403, appel("GET", "/admin/dispatch", null, client).status());
        assertEquals(403, appel("GET", "/livreur/offres", null, client).status());
    }

    @Test void deuxCollectesProchesRegroupeesEnUnSeulLot() throws Exception {
        long a = commandePrete().get("id").asLong(), b = commandePrete().get("id").asLong();
        JsonNode supervision = succes(200, appel("GET", "/admin/dispatch", null, admin));
        assertTrue(parId(supervision.get("enAttente"), a).get("lotId").isNull(), "sans livreur, aucun lot n'est fige");

        Coursier sami = coursierDisponible("Sami");
        JsonNode offre = offres(sami).get(0);
        assertEquals(2, offre.get("nbCommandes").asInt());
        assertEquals(30.0, offre.get("montantACollecter").asDouble(), 1e-9);
        assertEquals(List.of("COLLECTE", "COLLECTE", "LIVRAISON", "LIVRAISON"),
                liste(offre.get("etapes")).stream().map(e -> e.get("type").asText()).toList());

        JsonNode lot = succes(200, accepter(sami, offre.get("id").asLong()));
        assertEquals(Set.of(a, b), new HashSet<>(liste(lot.get("commandes")).stream().map(JsonNode::asLong).toList()));
        assertEquals(2, missions(sami).size());
        assertTrue(liste(missions(sami)).stream().allMatch(m -> m.get("statut").asText().equals("AFFECTEE")));
    }

    @Test void debordementVersUnLivreurDUneZoneVoisineSignaleHorsZone() throws Exception {
        long zoneVoisine = creerZone("Zone voisine " + latCommerce, latCommerce - .5, 21);   // frontiere commune a l'est
        Coursier rami = coursier("Rami");
        succes(201, appel("POST", "/admin/livreurs/" + rami.id() + "/zones", Map.of("zoneId", zoneVoisine, "type", "PRINCIPALE"), admin));
        succes(200, appel("PUT", "/livreur/disponibilite", Map.of("disponible", true, "latitude", latCommerce, "longitude", 21.5), rami.token()));

        commandePrete();
        JsonNode offre = offres(rami).get(0);
        assertTrue(offre.get("horsZone").asBoolean());
    }

    @Test void expirationRepropositionPuisAffectationForceeAuditee() throws Exception {
        Coursier sami = coursierDisponible("Sami"), nour = coursierDisponible("Nour");
        long id = commandePrete().get("id").asLong();
        Coursier premier = offres(sami).size() == 1 ? sami : nour, second = premier == sami ? nour : sami;
        long offre1 = offres(premier).get(0).get("id").asLong();

        // Le delai s'ecoule sans reponse : le cycle expire l'offre et la repropose
        var enBase = offresEnBase.findById(offre1).orElseThrow();
        enBase.setExpireLe(Instant.now().minusSeconds(1));
        offresEnBase.save(enBase);
        assertTrue(succes(200, appel("POST", "/admin/dispatch/cycle", null, admin)).get("offresExpirees").asInt() >= 1);
        assertEquals(0, offres(premier).size());
        assertEquals(1, offres(second).size());

        // Le responsable impose le premier livreur : l'offre du second est retiree
        assertEquals(400, appel("PUT", "/admin/dispatch/commandes/" + id + "/forcer", Map.of("livreurId", premier.id(), "motif", "ok"), admin).status());
        succes(200, appel("PUT", "/admin/dispatch/commandes/" + id + "/forcer",
                Map.of("livreurId", premier.id(), "motif", "Client prioritaire, livreur sur place"), admin));
        assertEquals(0, offres(second).size());
        assertEquals("AFFECTEE", missions(premier).get(0).get("statut").asText());
        assertEquals(409, appel("PUT", "/admin/dispatch/commandes/" + id + "/forcer",
                Map.of("livreurId", second.id(), "motif", "Deuxieme tentative"), admin).status());

        JsonNode audit = succes(200, appel("GET", "/admin/audit?action=AFFECTATION_FORCEE&cibleId=" + id, null, admin));
        assertEquals(1, audit.size());
        assertTrue(audit.get(0).get("details").asText().contains("Client prioritaire"));
    }
}
