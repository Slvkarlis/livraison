package com.fleetpulse.livraison;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.fleetpulse.livraison.Model.CodeRemise;
import com.fleetpulse.livraison.Repository.CodeRemiseRepository;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

/** US-305 / US-310 : QR de remise du client et code de secours par SMS (base H2). */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=jdbc:h2:mem:sprint3remiseclient;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
        "app.sprint2.donnees-demo=false", "app.commandes.intervalle-secondes=0", "app.commandes.actives-max=10" })
class Sprint3RemiseClientTest extends ParcoursSprint3 {
    @Autowired CodeRemiseRepository codes;

    @Test void qrDisponibleSeulementColisEnRoute() throws Exception {
        Coursier sami = coursierDisponible("Sami");
        long id = commandePrete().get("id").asLong();
        assertEquals("AFFECTEE", commandeClient(id).get("statut").asText());
        succes(409, appel("GET", "/commandes/" + id + "/qr-remise", null, client));

        String etiquette = succes(200, appel("GET", "/partenaire/commandes/" + id + "/etiquette", null, partenaire)).get("contenuQr").asText();
        succes(200, appel("POST", "/livreur/missions/" + id + "/collecte", java.util.Map.of("code", etiquette), sami.token()));
        var qr = succes(200, appel("GET", "/commandes/" + id + "/qr-remise", null, client));
        String codeSuivi = commandeClient(id).get("codeSuivi").asText();
        assertTrue(qr.get("contenuQr").asText().startsWith("FLEETPULSE-REMISE|" + codeSuivi + "|"));
        long duree = Instant.parse(qr.get("expireLe").asText()).getEpochSecond() - Instant.now().getEpochSecond();
        assertTrue(duree > 100 && duree <= 120, "durée limitée : " + duree + " s");
        assertNotEquals(qr.get("contenuQr").asText(), succes(200, appel("GET", "/commandes/" + id + "/qr-remise", null, client))
                .get("contenuQr").asText(), "chaque affichage génère un nouveau QR");

        succes(404, appel("GET", "/commandes/" + id + "/qr-remise", null, autreClient));
        assertEquals(403, appel("GET", "/commandes/" + id + "/qr-remise", null, sami.token()).status());
    }

    @Test void codeEnvoyeParSmsALaCollecteEtRenvoiLimite() throws Exception {
        Coursier sami = coursierDisponible("Sami");
        long id = commandeCollectee(sami);
        String codeSuivi = commandeClient(id).get("codeSuivi").asText();
        ArgumentCaptor<String> message = ArgumentCaptor.forClass(String.class);
        verify(notifications).envoyerSms(eq("+21620000001"), message.capture());
        assertTrue(message.getValue().matches(".*" + codeSuivi + " est [0-9]{6}[.].*"), message.getValue());
        CodeRemise code = codes.findByCommandeId(id).orElseThrow();
        assertFalse(code.getCodeHash().contains(message.getValue().replaceAll(".* est ([0-9]{6})[.].*", "$1")), "jamais en clair");

        assertEquals("TROP_DE_DEMANDES", succes(429, appel("POST", "/commandes/" + id + "/code-remise", null, client)).get("code").asText(),
                "une minute entre deux envois");
        for (int envoi = 2; envoi <= 4; envoi++) {
            code = codes.findByCommandeId(id).orElseThrow();
            code.setDernierEnvoiLe(Instant.now().minusSeconds(120));
            codes.save(code);
            var reponse = succes(200, appel("POST", "/commandes/" + id + "/code-remise", null, client));
            assertEquals("SMS au numéro se terminant par 001", reponse.get("destination").asText());
            assertEquals(envoi == 4, reponse.get("prochainEnvoiPossibleLe").isNull());
        }
        verify(notifications, times(4)).envoyerSms(eq("+21620000001"), anyString());
        code = codes.findByCommandeId(id).orElseThrow();
        code.setDernierEnvoiLe(Instant.now().minusSeconds(120));
        codes.save(code);
        assertTrue(succes(429, appel("POST", "/commandes/" + id + "/code-remise", null, client)).get("message").asText().contains("maximal"));
        succes(404, appel("POST", "/commandes/" + id + "/code-remise", null, autreClient));
    }
}
