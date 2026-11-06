package com.fleetpulse.livraison;

import static org.junit.jupiter.api.Assertions.*;
import com.fleetpulse.livraison.Service.NotificationSender;
import java.net.URI;
import java.net.http.*;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/**
 * Sans app.cors.origines, le backend ne filtre pas l'en-tete Origin (comportement d'avant le Sprint 2 bis).
 * Regression evitee : le relais Vite du back-office envoyait Origin localhost:5173 et la connexion etait refusee (403).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=jdbc:h2:mem:corsoff;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1", "app.cors.origines=" })
class CorsNonConfigureTest {
    @LocalServerPort int port;
    @MockitoBean NotificationSender notifications;

    @Test void uneOrigineQuelconqueNEstPasRefusee() throws Exception {
        var requete = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/auth/login"))
                .header("Content-Type", "application/json").header("Origin", "http://localhost:5173")
                .POST(HttpRequest.BodyPublishers.ofString("{\"email\":\"admin@sprint1.test\",\"motDePasse\":\"test-admin-password\"}")).build();
        assertEquals(200, HttpClient.newHttpClient().send(requete, HttpResponse.BodyHandlers.ofString()).statusCode());
    }
}
