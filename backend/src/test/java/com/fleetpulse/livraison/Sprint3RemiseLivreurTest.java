package com.fleetpulse.livraison;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.fleetpulse.livraison.Repository.CodeRemiseRepository;
import com.fleetpulse.livraison.Repository.LivraisonRepository;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

/** US-306 : le coursier confirme le montant encaisse puis valide la remise par le QR du client ou le code SMS (base H2). */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=jdbc:h2:mem:sprint3remiselivreur;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
        "app.sprint2.donnees-demo=false", "app.commandes.intervalle-secondes=0", "app.commandes.actives-max=10" })
class Sprint3RemiseLivreurTest extends ParcoursSprint3 {
    @Autowired CodeRemiseRepository codes;
    @Autowired LivraisonRepository livraisons;

    Reponse remettre(Coursier c, long id, Object montant, String motif, String preuve) throws Exception {
        Map<String, Object> corps = new HashMap<>();
        corps.put("montantEncaisse", montant);
        corps.put("motifEcart", motif);
        corps.put("preuve", preuve);
        return appel("POST", "/livreur/missions/" + id + "/remise", corps, c.token());
    }

    String qrClient(long id) throws Exception {
        return succes(200, appel("GET", "/commandes/" + id + "/qr-remise", null, client)).get("contenuQr").asText();
    }

    /** Code en clair intercepte dans le dernier SMS envoye au client. */
    String dernierCodeSms() {
        ArgumentCaptor<String> message = ArgumentCaptor.forClass(String.class);
        verify(notifications, atLeastOnce()).envoyerSms(eq("+21620000001"), message.capture());
        return message.getValue().replaceAll(".* est ([0-9]{6})[.].*", "$1");
    }

    @Test void remiseParQrMontantExact() throws Exception {
        Coursier sami = coursierDisponible("Sami");
        long id = commandeCollectee(sami);
        String ancien = qrClient(id), qr = qrClient(id);

        assertTrue(succes(400, remettre(sami, id, 15, null, ancien)).get("message").asText().contains("remplacé"),
                "seul le dernier QR affiché est valable");
        assertTrue(succes(400, remettre(sami, id, null, null, qr)).get("message").asText().contains("montant"));

        var mission = succes(200, remettre(sami, id, 15.000, null, qr));
        assertEquals("LIVREE", mission.get("statut").asText());
        assertEquals(0, mission.get("montantEncaisse").decimalValue().compareTo(new java.math.BigDecimal("15")));
        assertFalse(mission.get("livreeLe").isNull());

        var vue = commandeClient(id);
        assertEquals("LIVREE", vue.get("statut").asText());
        var c = livraisons.findById(id).orElseThrow();
        assertEquals("QR", c.getModeRemise().name());
        assertEquals("ENCAISSE", c.getStatutPaiement().name());
        assertEquals(0, c.getEcartEncaissement().signum());

        assertEquals("LIVREE", succes(200, remettre(sami, id, 15, null, qr)).get("statut").asText(), "rejeu sans effet");
        succes(409, appel("GET", "/commandes/" + id + "/qr-remise", null, client));
        assertTrue(succes(200, appel("GET", "/livreur/missions", null, sami.token())).isEmpty(), "plus dans les missions en cours");
    }

    @Test void ecartAvecMotifEtCodeSms() throws Exception {
        Coursier sami = coursierDisponible("Sami");
        long id = commandeCollectee(sami);
        String code = dernierCodeSms();
        String faux = code.equals("000000") ? "111111" : "000000";

        assertTrue(succes(400, remettre(sami, id, 14.5, null, code)).get("message").asText().contains("motif"),
                "un écart exige un motif");
        assertEquals(0, codes.findByCommandeId(id).orElseThrow().getTentatives(), "erreur de montant : aucun essai consommé");
        succes(400, remettre(sami, id, 14.5, "Pas de monnaie", faux));
        assertEquals(1, codes.findByCommandeId(id).orElseThrow().getTentatives(), "essai raté compté malgré l'échec");

        assertEquals("LIVREE", succes(200, remettre(sami, id, 14.5, "Pas de monnaie", code.substring(0, 3) + " " + code.substring(3)))
                .get("statut").asText());
        var c = livraisons.findById(id).orElseThrow();
        assertEquals("CODE", c.getModeRemise().name());
        assertEquals(0, c.getEcartEncaissement().compareTo(new java.math.BigDecimal("-0.5")));
        assertEquals("Pas de monnaie", c.getMotifEcart());
    }

    @Test void codeBloqueApresCinqEssais() throws Exception {
        Coursier sami = coursierDisponible("Sami");
        long id = commandeCollectee(sami);
        String code = dernierCodeSms();
        String faux = code.equals("000000") ? "111111" : "000000";
        for (int i = 1; i <= 4; i++) succes(400, remettre(sami, id, 15, null, faux));
        succes(409, remettre(sami, id, 15, null, faux));
        assertTrue(succes(409, remettre(sami, id, 15, null, code)).get("message").asText().contains("nouveau"),
                "même le bon code est refusé une fois bloqué");
        assertEquals("LIVREE", succes(200, remettre(sami, id, 15, null, qrClient(id))).get("statut").asText(), "le QR reste possible");
    }

    @Test void reglesDAcces() throws Exception {
        Coursier sami = coursierDisponible("Sami"), ali = coursierDisponible("Ali");
        long id = commandePrete().get("id").asLong();
        Coursier affecte = livraisons.findById(id).orElseThrow().getLivreur().getId() == sami.id() ? sami : ali;
        Coursier autre = affecte == sami ? ali : sami;
        assertTrue(succes(409, remettre(affecte, id, 15, null, "123456")).get("message").asText().contains("Récupérez"));
        succes(404, remettre(autre, id, 15, null, "123456"));
        assertEquals(403, appel("POST", "/livreur/missions/" + id + "/remise", Map.of("montantEncaisse", 15, "preuve", "123456"), client).status());

        String etiquette = succes(200, appel("GET", "/partenaire/commandes/" + id + "/etiquette", null, partenaire)).get("contenuQr").asText();
        succes(200, appel("POST", "/livreur/missions/" + id + "/collecte", Map.of("code", etiquette), affecte.token()));
        assertTrue(succes(400, remettre(affecte, id, 15, null, etiquette)).get("message").asText().contains("QR non reconnu"),
                "l'étiquette du colis n'est pas une preuve de remise");
    }
}
