package com.fleetpulse.livraison;

import static org.junit.jupiter.api.Assertions.*;
import java.net.URI;
import java.net.http.*;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Complément du TP : vérifie aussi le CRUD réel avec Spring Security et une base H2 isolée. */
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,properties={
        "spring.datasource.url=jdbc:h2:mem:vehicule_tp5;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
        "app.sprint2.donnees-demo=false"})
class VehiculeCrudIntegrationTest {
    @LocalServerPort int port;
    final HttpClient http=HttpClient.newHttpClient();
    final JsonMapper json=JsonMapper.builder().build();
    String token;
    HttpResponse<String> appel(String methode,String chemin,String corps) throws Exception {
        var r=HttpRequest.newBuilder(URI.create("http://localhost:"+port+chemin)).header("Content-Type","application/json")
                .method(methode,corps==null?HttpRequest.BodyPublishers.noBody():HttpRequest.BodyPublishers.ofString(corps));
        if(token!=null)r.header("Authorization","Bearer "+token);
        return http.send(r.build(),HttpResponse.BodyHandlers.ofString());
    }
    JsonNode succes(int statut,HttpResponse<String> r) {
        assertEquals(statut,r.statusCode(),r.body());return r.body().isBlank()?null:json.readTree(r.body());
    }
    @Test void crudReelConserveHistoriqueEtRespecteLesStatutsHttp() throws Exception {
        assertEquals(401,appel("GET","/api/admin/vehicules/1",null).statusCode());
        token=succes(200,appel("POST","/api/auth/login","{\"email\":\"admin@sprint1.test\",\"motDePasse\":\"test-admin-password\"}")).get("token").asText();
        var cree=succes(201,appel("POST","/api/admin/vehicules","{\"immatriculation\":\"TP5-UNIQUE\",\"type\":\"Scooter\",\"capaciteKg\":30,\"consommationLitres100Km\":3}"));
        long id=cree.get("id").asLong();String route="/api/admin/vehicules/"+id;
        assertEquals("TP5-UNIQUE",succes(200,appel("GET",route,null)).get("immatriculation").asText());
        assertTrue(succes(200,appel("GET","/api/admin/vehicules",null)).isArray());
        assertEquals("Voiture",succes(200,appel("PUT",route,"{\"type\":\"Voiture\",\"consommationLitres100Km\":6}")).get("type").asText());
        assertEquals(400,appel("PUT",route,"{\"consommationLitres100Km\":99}").statusCode());
        assertEquals(409,appel("POST","/api/admin/vehicules","{\"immatriculation\":\"TP5-UNIQUE\"}").statusCode());
        succes(204,appel("DELETE",route,null));
        assertFalse(succes(200,appel("GET",route,null)).get("actif").asBoolean());
        for(String methode:java.util.List.of("GET","PUT","DELETE"))
            assertEquals(404,appel(methode,"/api/admin/vehicules/999999",methode.equals("PUT")?"{}":null).statusCode());
    }
}
