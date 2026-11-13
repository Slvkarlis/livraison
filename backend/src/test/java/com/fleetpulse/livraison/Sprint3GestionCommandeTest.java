package com.fleetpulse.livraison;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.fleetpulse.livraison.Model.enums.ActionAudit;
import com.fleetpulse.livraison.Repository.JournalAuditRepository;
import com.fleetpulse.livraison.Repository.LivraisonRepository;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import tools.jackson.databind.JsonNode;

/** US-311 : annulation, collecte et remise validees par le responsable, avec motif, historique et audit (base H2). */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=jdbc:h2:mem:sprint3gestion;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
        "app.sprint2.donnees-demo=false", "app.commandes.intervalle-secondes=0", "app.commandes.actives-max=10" })
class Sprint3GestionCommandeTest extends ParcoursSprint3 {
    @Autowired JournalAuditRepository journal;
    @Autowired LivraisonRepository livraisons;

    String route(long id, String action) { return "/admin/commandes/" + id + "/" + action; }

    List<String> actions(JsonNode suivi) {
        return StreamSupport.stream(suivi.get("actions").spliterator(), false).map(JsonNode::asText).toList();
    }

    boolean audite(ActionAudit action, long id) {
        return journal.findAll().stream().anyMatch(j -> j.getAction() == action && Long.valueOf(id).equals(j.getCibleId()));
    }

    List<String> messagesClient(long id) throws Exception {
        return StreamSupport.stream(succes(200, appel("GET", "/notifications", null, client)).get("notifications").spliterator(), false)
                .filter(n -> n.get("commandeId").asLong() == id).map(n -> n.get("message").asText()).toList();
    }

    @Test void annulationColisABord() throws Exception {
        Coursier sami = coursierDisponible("Sami");
        long id = commandeCollectee(sami);
        assertEquals(List.of("VALIDER_REMISE", "ANNULER"), actions(succes(200, appel("GET", route(id, "suivi"), null, admin))));

        assertTrue(succes(400, appel("PUT", route(id, "annuler"), Map.of("motif", "  "), admin)).get("message").asText().contains("motif"));
        JsonNode suivi = succes(200, appel("PUT", route(id, "annuler"), Map.of("motif", "Client injoignable, adresse introuvable"), admin));
        assertEquals("ANNULEE", suivi.get("statut").asText());
        assertEquals("Client injoignable, adresse introuvable", suivi.get("motifAnnulation").asText());
        assertTrue(actions(suivi).isEmpty());
        JsonNode derniere = suivi.get("historique").get(suivi.get("historique").size() - 1);
        assertEquals("RESPONSABLE", derniere.get("acteurRole").asText());
        assertTrue(derniere.get("motif").asText().endsWith("adresse introuvable"));
        assertTrue(audite(ActionAudit.COMMANDE_ANNULEE, id));

        assertTrue(messagesClient(id).getFirst().contains("annulée par notre service client : Client injoignable"));
        assertTrue(commandeClient(id).get("annuleeParService").asBoolean(), "l'écran du client dit qui a annulé");
        succes(409, appel("PUT", route(id, "annuler"), Map.of("motif", "Encore une fois"), admin));
        succes(409, appel("GET", "/commandes/" + id + "/qr-remise", null, client));
        succes(409, appel("POST", "/livreur/missions/" + id + "/remise", Map.of("montantEncaisse", 15, "preuve", "123456"), sami.token()));
        assertTrue(succes(200, appel("GET", "/livreur/missions", null, sami.token())).isEmpty(), "mission retirée au livreur");
    }

    @Test void collecteEtRemiseManuelles() throws Exception {
        coursierDisponible("Sami");
        long id = commandePrete().get("id").asLong();
        assertEquals(List.of("VALIDER_COLLECTE", "ANNULER"), actions(succes(200, appel("GET", route(id, "suivi"), null, admin))));
        succes(409, appel("PUT", route(id, "remise"), Map.of("motif", "Téléphone du client éteint", "montantEncaisse", 15), admin));

        JsonNode suivi = succes(200, appel("PUT", route(id, "collecte"), Map.of("motif", "Étiquette déchirée"), admin));
        assertEquals("RECUPEREE", suivi.get("statut").asText());
        assertFalse(suivi.get("recupereeLe").isNull());
        verify(notifications).envoyerSms(eq("+21620000001"), contains("code de remise"));
        assertTrue(audite(ActionAudit.COLLECTE_VALIDEE_MANUELLEMENT, id));
        succes(409, appel("PUT", route(id, "collecte"), Map.of("motif", "Étiquette déchirée"), admin));

        Map<String, Object> remise = new HashMap<>(Map.of("motif", "Téléphone du client éteint", "montantEncaisse", 14));
        assertTrue(succes(400, appel("PUT", route(id, "remise"), remise, admin)).get("message").asText().contains("écart"));
        remise.put("motifEcart", "Remise commerciale accordée");
        suivi = succes(200, appel("PUT", route(id, "remise"), remise, admin));
        assertEquals("LIVREE", suivi.get("statut").asText());
        assertEquals("MANUELLE", suivi.get("modeRemise").asText());
        assertEquals(0, suivi.get("ecartEncaissement").decimalValue().compareTo(new java.math.BigDecimal("-1")));
        assertEquals("ENCAISSE", livraisons.findById(id).orElseThrow().getStatutPaiement().name());
        assertTrue(audite(ActionAudit.REMISE_VALIDEE_MANUELLEMENT, id));
        succes(409, appel("PUT", route(id, "annuler"), Map.of("motif", "Trop tard pour annuler"), admin));
    }

    @Test void clientNonNotifieDeSaPropreAnnulationEtAcces() throws Exception {
        long id = commandePrete().get("id").asLong();
        assertEquals(403, appel("GET", route(id, "suivi"), null, client).status());
        assertEquals(403, appel("PUT", route(id, "annuler"), Map.of("motif", "Je veux annuler"), partenaire).status());
        succes(404, appel("GET", route(999_999, "suivi"), null, admin));

        // Commande en attente annulee par le client : pas de notification pour sa propre action
        Map<String, Object> panier = new HashMap<>(Map.of("partenaireId", partenaireId, "adresseId", adresseId,
                "lignes", List.of(Map.of("produitId", produitId, "quantite", 1)), "notes", ""));
        panier.put("devisEmpreinte", succes(200, appel("POST", "/commandes/devis", panier, client)).get("empreinte").asText());
        panier.put("cleIdempotence", java.util.UUID.randomUUID().toString());
        long attente = succes(201, appel("POST", "/commandes", panier, client)).get("id").asLong();
        succes(200, appel("PUT", "/commandes/" + attente + "/annuler", null, client));
        assertTrue(messagesClient(attente).isEmpty());
        assertFalse(commandeClient(attente).get("annuleeParService").asBoolean());
    }
}
