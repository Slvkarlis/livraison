package com.fleetpulse.livraison;

import static org.junit.jupiter.api.Assertions.*;
import com.fleetpulse.livraison.Service.NotificationSender;
import java.net.URI;
import java.net.http.*;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/** Avec app.cors.origines (apercu Expo web), seules les origines listees peuvent appeler l'API depuis un navigateur. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=jdbc:h2:mem:corson;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
        "app.cors.origines=http://localhost:8081" })
class CorsConfigureTest {
    @LocalServerPort int port;
    @MockitoBean NotificationSender notifications;

    HttpResponse<String> connexionDepuis(String origine) throws Exception {
        var requete = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/auth/login"))
                .header("Content-Type", "application/json").header("Origin", origine)
                .POST(HttpRequest.BodyPublishers.ofString("{\"email\":\"admin@sprint1.test\",\"motDePasse\":\"test-admin-password\"}")).build();
        return HttpClient.newHttpClient().send(requete, HttpResponse.BodyHandlers.ofString());
    }

    @Test void origineAutoriseeAccepteeAvecEnTeteCors() throws Exception {
        var reponse = connexionDepuis("http://localhost:8081");
        assertEquals(200, reponse.statusCode());
        assertEquals("http://localhost:8081", reponse.headers().firstValue("Access-Control-Allow-Origin").orElse(null));
    }

    @Test void origineNonListeeRefusee() throws Exception {
        assertEquals(403, connexionDepuis("http://site-inconnu.example").statusCode());
    }
}
