package com.fleetpulse.livraison;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.fleetpulse.livraison.Repository.AppareilNotificationRepository;
import com.fleetpulse.livraison.Service.PushSender;
import java.util.List;
import java.util.Map;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import tools.jackson.databind.JsonNode;

/** US-304 : notification du client a chaque changement de statut (boite, push), base H2. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=jdbc:h2:mem:sprint3notifications;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
        "app.sprint2.donnees-demo=false", "app.commandes.intervalle-secondes=0", "app.commandes.actives-max=10" })
class Sprint3NotificationTest extends ParcoursSprint3 {
    static final String JETON = "ExponentPushToken[abcdefghijklmnop12]";
    @MockitoBean PushSender push;
    @Autowired AppareilNotificationRepository appareils;

    List<JsonNode> notificationsDe(long commandeId) throws Exception {
        JsonNode boite = succes(200, appel("GET", "/notifications", null, client));
        return StreamSupport.stream(boite.get("notifications").spliterator(), false)
                .filter(n -> n.get("commandeId").asLong() == commandeId).toList();
    }

    @Test void unePourChaqueChangementDeStatut() throws Exception {
        when(push.envoyer(anyList(), anyString(), anyString(), anyMap())).thenReturn(List.of());
        succes(204, appel("PUT", "/notifications/appareil", Map.of("jeton", JETON), client));
        Coursier sami = coursierDisponible("Sami");
        long id = commandeCollectee(sami);

        List<String> statuts = notificationsDe(id).stream().map(n -> n.get("statut").asText()).toList();
        assertEquals(List.of("RECUPEREE", "AFFECTEE", "PRETE", "ACCEPTEE"), statuts, "la plus récente d'abord, pas pour la commande passée");
        JsonNode derniere = notificationsDe(id).getFirst();
        assertTrue(derniere.get("message").asText().startsWith("Sami a récupéré votre commande"));
        assertTrue(derniere.get("titre").asText().endsWith(commandeClient(id).get("codeSuivi").asText()));
        assertFalse(derniere.get("lue").asBoolean());
        verify(push).envoyer(eq(List.of(JETON)), startsWith("Commande en route"), anyString(), eq(Map.of("commandeId", id)));
        verify(push, times(4)).envoyer(eq(List.of(JETON)), anyString(), anyString(), anyMap());

        assertTrue(succes(200, appel("GET", "/notifications", null, client)).get("nonLues").asLong() >= 4);
        succes(204, appel("PUT", "/notifications/lues", null, client));
        assertEquals(0, succes(200, appel("GET", "/notifications", null, client)).get("nonLues").asLong());
        assertTrue(notificationsDe(id).stream().allMatch(n -> n.get("lue").asBoolean()));
    }

    @Test void appareilsEtJetonsInvalides() throws Exception {
        succes(400, appel("PUT", "/notifications/appareil", Map.of("jeton", "pas-un-jeton"), client));
        succes(204, appel("PUT", "/notifications/appareil", Map.of("jeton", JETON), client));
        // Meme telephone, autre compte : le jeton change de proprietaire
        succes(204, appel("PUT", "/notifications/appareil", Map.of("jeton", JETON), autreClient));
        succes(204, appel("DELETE", "/notifications/appareil", Map.of("jeton", JETON), client));
        assertTrue(appareils.findByJeton(JETON).isPresent(), "le client ne retire pas le jeton d'un autre compte");
        succes(204, appel("PUT", "/notifications/appareil", Map.of("jeton", JETON), client));

        // Application desinstallee : le service de push le signale, le jeton est oublie
        when(push.envoyer(anyList(), anyString(), anyString(), anyMap())).thenReturn(List.of(JETON));
        commandePrete();
        assertTrue(appareils.findByJeton(JETON).isEmpty());
        assertEquals(401, appel("GET", "/notifications", null, null).status());
    }
}
