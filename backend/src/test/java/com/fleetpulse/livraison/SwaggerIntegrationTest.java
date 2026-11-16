package com.fleetpulse.livraison;

import static org.junit.jupiter.api.Assertions.*;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=jdbc:h2:mem:swagger;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
        "springdoc.swagger-ui.path=/swagger-ui.html", "springdoc.api-docs.path=/api-docs",
        "app.sprint2.donnees-demo=false" })
class SwaggerIntegrationTest {
    @LocalServerPort int port;
    final HttpClient http = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NORMAL).build();
    final JsonMapper json = JsonMapper.builder().build();

    HttpResponse<String> get(String path) throws Exception {
        return http.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + path)).GET().build(),
                HttpResponse.BodyHandlers.ofString());
    }

    @Test void documentationAccessibleSansAuthentification() throws Exception {
        var page = get("/swagger-ui.html");
        assertEquals(200, page.statusCode());
        assertTrue(page.body().contains("swagger-ui"));
        assertEquals(200, get("/swagger-ui/swagger-ui-bundle.js").statusCode());

        var config = get("/api-docs/swagger-config");
        assertEquals(200, config.statusCode());
        assertEquals("/api-docs", json.readTree(config.body()).get("url").asText());

        var docs = get("/api-docs");
        assertEquals(200, docs.statusCode());
        var api = json.readTree(docs.body());
        assertTrue(api.get("openapi").asText().startsWith("3."));
        var scheme = api.at("/components/securitySchemes/bearerAuth");
        assertEquals("http", scheme.get("type").asText());
        assertEquals("bearer", scheme.get("scheme").asText());
        assertTrue(api.get("security").get(0).has("bearerAuth"));
        assertTrue(api.get("paths").get("/api/admin/comptes").has("get"));
        var login = api.get("paths").get("/api/auth/login").get("post");
        assertTrue(login.get("security").isArray());
        assertTrue(login.get("security").isEmpty());
    }

    @Test void apiMetierToujoursProtegeeEtAccessibleAvecJwt() throws Exception {
        assertEquals(401, get("/api/admin/comptes").statusCode());
        assertEquals(200, get("/api/auth/config").statusCode());

        var request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/auth/login"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(
                        "{\"email\":\"admin@sprint1.test\",\"motDePasse\":\"test-admin-password\"}"))
                .build();
        var login = http.send(request, HttpResponse.BodyHandlers.ofString());
        assertEquals(200, login.statusCode());
        String token = json.readTree(login.body()).get("token").asText();
        var protectedRequest = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/admin/comptes"))
                .header("Authorization", "Bearer " + token).GET().build();
        assertEquals(200, http.send(protectedRequest, HttpResponse.BodyHandlers.ofString()).statusCode());
    }
}
