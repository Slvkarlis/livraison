package com.fleetpulse.livraison;

import static org.junit.jupiter.api.Assertions.*;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.*;
import com.fleetpulse.livraison.Repository.*;
import com.fleetpulse.livraison.Service.NotificationSender;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=jdbc:h2:mem:sprint2;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1", "app.sprint2.donnees-demo=false" })
class Sprint2ParcoursTest {
    @LocalServerPort int port;
    @Autowired UtilisateurRepository utilisateurs;
    @Autowired LivraisonRepository commandes;
    @Autowired PasswordEncoder encoder;
    @MockitoBean NotificationSender notifications;
    final JsonMapper json = JsonMapper.builder().build();
    final HttpClient http = HttpClient.newHttpClient();
    static final AtomicInteger sequence = new AtomicInteger();
    String admin, client, autreClient, partenaire, autrePartenaire, finance, candidat;
    long partenaireId, produitId, autreProduitId, adresseId, autreAdresseId, zoneId;
    double lat;
    record Reponse(int status, JsonNode data) { }
    Reponse appel(String methode, String route, Object body, String token) throws Exception {
        var b = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api" + route)).header("Content-Type", "application/json")
                .method(methode, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)));
        if (token != null) b.header("Authorization", "Bearer " + token);
        var r = http.send(b.build(), HttpResponse.BodyHandlers.ofString());
        return new Reponse(r.statusCode(), r.body().isBlank() ? null : json.readTree(r.body()));
    }
    JsonNode succes(int status, Reponse r) { assertEquals(status, r.status(), String.valueOf(r.data())); return r.data(); }
    String login(String email) throws Exception { return succes(200, appel("POST", "/auth/login", Map.of("email", email, "motDePasse", "sprint2-password"), null)).get("token").asText(); }
    <T extends Utilisateur> T compte(T u, Role role) {
        u.setEmail(UUID.randomUUID()+"@sprint2.test"); u.setNom("Test"); u.setPrenom("Sprint2"); u.setRole(role); u.setMotDePasseHash(encoder.encode("sprint2-password"));
        return u;
    }
    Map<String,Object> zone(double y, double x, String nom) { return Map.of("nom", nom, "fraisLivraison", 3.5, "polygone", List.of(
            Map.of("latitude",y,"longitude",x),Map.of("latitude",y,"longitude",x+1),Map.of("latitude",y+1,"longitude",x+1),Map.of("latitude",y+1,"longitude",x))); }
    @BeforeEach void preparer() throws Exception {
        lat = 10 + sequence.incrementAndGet()*2;
        admin = succes(200,appel("POST","/auth/login",Map.of("email","admin@sprint1.test","motDePasse","test-admin-password"),null)).get("token").asText();
        Client c = utilisateurs.save(compte(new Client(), Role.CLIENT)); client = login(c.getEmail());
        Client c2 = utilisateurs.save(compte(new Client(), Role.CLIENT)); autreClient = login(c2.getEmail());
        Partenaire p = compte(new Partenaire(), Role.PARTENAIRE); p.setNomCommerce("Commerce A"); p.setCategorie("Restaurant"); p.setAdresse("Adresse commerce"); p.setLatitude(lat+.5); p.setLongitude(10.5); utilisateurs.save(p); partenaireId=p.getId(); partenaire=login(p.getEmail());
        Partenaire p2 = compte(new Partenaire(), Role.PARTENAIRE); p2.setNomCommerce("Commerce B"); p2.setCategorie("Épicerie"); p2.setAdresse("Commerce B"); p2.setLatitude(lat+.4); p2.setLongitude(10.4); utilisateurs.save(p2); autrePartenaire=login(p2.getEmail());
        Responsable f = compte(new Responsable(),Role.RESPONSABLE); f.setSousRole(SousRole.FINANCE); utilisateurs.save(f); finance=login(f.getEmail());
        Partenaire attente = compte(new Partenaire(), Role.PARTENAIRE); attente.setStatut(StatutCompte.EN_ATTENTE); utilisateurs.save(attente); candidat=login(attente.getEmail());
        zoneId=succes(201,appel("POST","/admin/zones",zone(lat,10,"Zone " + lat),admin)).get("id").asLong();
        succes(200,appel("PUT","/partenaire/commerce",Map.of("ouvert",true),partenaire)); succes(200,appel("PUT","/partenaire/commerce",Map.of("ouvert",true),autrePartenaire));
        produitId=succes(201,appel("POST","/partenaire/produits",Map.of("nom","Article A","prix",12.125,"disponible",true),partenaire)).get("id").asLong();
        autreProduitId=succes(201,appel("POST","/partenaire/produits",Map.of("nom","Article B","prix",8,"disponible",true),autrePartenaire)).get("id").asLong();
        adresseId=adresse(client,lat+.5,10.5); autreAdresseId=adresse(autreClient,lat+.5,10.5);
    }
    long adresse(String token, double y,double x) throws Exception { return succes(201,appel("POST","/adresses",Map.of("libelle","Maison","adresse","Rue de test","latitude",y,"longitude",x),token)).get("id").asLong(); }
    Map<String,Object> panier() { return new HashMap<>(Map.of("partenaireId",partenaireId,"adresseId",adresseId,"lignes",List.of(Map.of("produitId",produitId,"quantite",2)),"notes","Sans sel")); }
    Map<String,Object> confirmation() throws Exception { Map<String,Object> r=panier(); r.put("devisEmpreinte",succes(200,appel("POST","/commandes/devis",r,client)).get("empreinte").asText()); r.put("cleIdempotence",UUID.randomUUID().toString()); return r; }

    @Test void parcoursCompletEtPrixFiges() throws Exception {
        var liste=succes(200,appel("GET","/partenaires?adresseId="+adresseId,null,client)); assertEquals(2,liste.size());
        assertEquals(1,succes(200,appel("GET","/partenaires?adresseId="+adresseId+"&categorie=Restaurant&recherche=Commerce",null,client)).size());
        assertEquals(1,succes(200,appel("GET","/partenaires/"+partenaireId+"/produits?adresseId="+adresseId,null,client)).size());
        var body=confirmation(); body.put("total",0); body.put("fraisLivraison",0);
        var c=succes(201,appel("POST","/commandes",body,client)); assertEquals("PENDING_PARTNER",c.get("statut").asText()); assertEquals("COD",c.get("modePaiement").asText());
        assertEquals(24.250,c.get("montantArticles").asDouble(),.00001); assertEquals(3.5,c.get("fraisLivraison").asDouble()); assertEquals(27.750,c.get("montantTotal").asDouble(),.00001); assertEquals(27.750,c.get("montantACollecter").asDouble(),.00001);
        succes(200,appel("PUT","/partenaire/produits/"+produitId,Map.of("nom","Nouveau nom","prix",99,"disponible",true),partenaire));
        var historique=succes(200,appel("GET","/livraisons/mes",null,client)); assertEquals(1,historique.size()); assertEquals("Commerce A",historique.get(0).get("nomPartenaire").asText());
        assertEquals("Article A",historique.get(0).get("lignes").get(0).get("nomProduit").asText()); assertEquals(12.125,historique.get(0).get("lignes").get(0).get("prixUnitaire").asDouble());
        assertEquals(0,succes(200,appel("GET","/livraisons/mes",null,autreClient)).size());
    }
    @Test void refusePanierVideQuantitesDoublonsEtMultiPartenaire() throws Exception {
        for(Object lignes : List.of(List.of(),List.of(Map.of("produitId",produitId,"quantite",0)),List.of(Map.of("produitId",produitId,"quantite",100)),
                List.of(Map.of("produitId",produitId,"quantite",1),Map.of("produitId",produitId,"quantite",1)),
                List.of(Map.of("produitId",produitId,"quantite",1),Map.of("produitId",autreProduitId,"quantite",1)))) {
            var r=panier();r.put("lignes",lignes);succes(400,appel("POST","/commandes/devis",r,client));
        }
        var r=panier(); r.put("notes","x".repeat(501));succes(400,appel("POST","/commandes/devis",r,client));
    }
    @Test void refuseHorsZoneEtAutreZone() throws Exception {
        long hors=adresse(client,0,0); var r=panier();r.put("adresseId",hors); var erreur=succes(400,appel("POST","/commandes/devis",r,client));assertTrue(erreur.get("message").asText().contains("non desservie"));
        succes(201,appel("POST","/admin/zones",zone(lat,11,"Zone voisine"),admin)); r.put("adresseId",adresse(client,lat+.5,11.5));succes(400,appel("POST","/commandes/devis",r,client));
    }
    @Test void refusePartenaireFermeEtProduitIndisponibleMemeApresDevis() throws Exception {
        var r=confirmation(); succes(200,appel("PUT","/partenaire/commerce",Map.of("ouvert",false),partenaire));succes(409,appel("POST","/commandes",r,client));
        succes(200,appel("PUT","/partenaire/commerce",Map.of("ouvert",true),partenaire));
        succes(200,appel("PUT","/partenaire/produits/"+produitId,Map.of("nom","Article A","prix",12.125,"disponible",false),partenaire));succes(409,appel("POST","/commandes",r,client));
    }
    @Test void refuseMontantsMinimumMaximumEtPrixInvalides() throws Exception {
        for (Object prix: List.of(0,-1,1.0001,100001)) succes(400,appel("POST","/partenaire/produits",Map.of("nom","Invalide","prix",prix,"disponible",true),partenaire));
        for(double prix:new double[]{.1,999}) {
            succes(200,appel("PUT","/partenaire/produits/"+produitId,Map.of("nom","Article A","prix",prix,"disponible",true),partenaire));succes(400,appel("POST","/commandes/devis",panier(),client));
        }
    }
    @Test void isolationCataloguesAdressesEtDroitsServeur() throws Exception {
        succes(403,appel("PUT","/partenaire/produits/"+produitId,Map.of("nom","Vol","prix",1,"disponible",true),autrePartenaire));
        assertEquals(1,succes(200,appel("GET","/partenaire/produits",null,autrePartenaire)).size());
        var r=panier();r.put("adresseId",autreAdresseId);succes(403,appel("POST","/commandes/devis",r,client));
        succes(403,appel("DELETE","/adresses/"+autreAdresseId,null,client));
        for(String token:List.of(client,partenaire,finance,candidat)) succes(403,appel("GET","/admin/zones",null,token));
        for(String token:List.of(client,finance,candidat)) succes(403,appel("GET","/partenaire/produits",null,token));
        for(String token:List.of(partenaire,finance,candidat)) succes(403,appel("POST","/commandes",panier(),token));
        succes(401,appel("GET","/adresses",null,null));
        succes(400,appel("GET","/partenaires",null,client));
    }
    @Test void idempotenceConcurrenteEtCleReutilisee() throws Exception {
        var r=confirmation(); try(var pool=Executors.newFixedThreadPool(2)) {
            var a=pool.submit(()->appel("POST","/commandes",r,client)); var b=pool.submit(()->appel("POST","/commandes",r,client));
            assertEquals(succes(201,a.get()).get("id").asLong(),succes(201,b.get()).get("id").asLong());
        }
        assertEquals(1,succes(200,appel("GET","/livraisons/mes",null,client)).size());
        r.put("notes","Autre panier");succes(409,appel("POST","/commandes",r,client));
    }
    @Test void changementTarifExigeNouveauDevisEtAudit() throws Exception {
        var r=confirmation();var z=new HashMap<>(zone(lat,10,"Zone modifiée"));z.put("fraisLivraison",5);
        succes(200,appel("PUT","/admin/zones/"+zoneId,z,admin));succes(409,appel("POST","/commandes",r,client));
        var nouveau=succes(200,appel("POST","/commandes/devis",panier(),client));assertEquals(5,nouveau.get("fraisLivraison").asDouble());
        assertTrue(succes(200,appel("GET","/admin/audit/page?action=FRAIS_ZONE_MODIFIES",null,finance)).get("totalElements").asInt()>0);
    }
    @Test void zonesAdjacentesChevauchementSuppressionEtFrontiere() throws Exception {
        succes(400,appel("POST","/admin/zones",zone(lat+.2,10.2,"Chevauchement"),admin));
        long voisine=succes(201,appel("POST","/admin/zones",zone(lat,11,"Adjacente"),admin)).get("id").asLong();
        long bord=adresse(client,lat+.5,11);var r=panier();r.put("adresseId",bord);succes(200,appel("POST","/commandes/devis",r,client));
        succes(409,appel("DELETE","/admin/zones/"+zoneId,null,admin));succes(204,appel("DELETE","/admin/zones/"+voisine,null,admin));
    }
    @Test void limitationFrequenceEtCommandesActives() throws Exception {
        succes(201,appel("POST","/commandes",confirmation(),client));
        var r=confirmation();succes(429,appel("POST","/commandes",r,client));
        for(int i=0;i<2;i++) {
            for(Livraison l:commandes.findAll()) { l.setDateCreation(Instant.now().minusSeconds(120));commandes.save(l); }
            succes(201,appel("POST","/commandes",confirmation(),client));
        }
        succes(409,appel("POST","/commandes",confirmation(),client));
    }
    @Test void adressesMultiplesCorrectionEtCopieHistorique() throws Exception {
        var c=succes(201,appel("POST","/commandes",confirmation(),client));
        succes(200,appel("PUT","/adresses/"+adresseId,Map.of("libelle","Bureau","adresse","Nouvelle rue","latitude",lat+.3,"longitude",10.3),client));
        succes(204,appel("DELETE","/adresses/"+adresseId,null,client));
        assertEquals("Rue de test",succes(200,appel("GET","/livraisons/mes",null,client)).get(0).get("adresse").asText());
        assertNotNull(c.get("id"));
    }
    @Test void ancienCodSansArticlesRefuseEtAncienneCommandeLisible() throws Exception {
        succes(400,appel("POST","/livraisons",Map.of("modePaiement","COD"),client));
        Client c=(Client)utilisateurs.findById(succes(200,appel("GET","/me",null,client)).get("id").asLong()).orElseThrow();
        Livraison ancienne=new Livraison();ancienne.setClient(c);ancienne.setCodeSuivi(UUID.randomUUID().toString());ancienne.setAdresse("Ancienne adresse");ancienne.setLatitude(0.);ancienne.setLongitude(0.);ancienne.setCreneauDebut(Instant.now());ancienne.setCreneauFin(Instant.now());ancienne.setMontantACollecter(4);commandes.save(ancienne);
        var h=succes(200,appel("GET","/livraisons/mes",null,client)).get(0);assertTrue(h.get("partenaireId").isNull());assertEquals(0,h.get("lignes").size());assertEquals(4,h.get("montantTotal").asDouble());
    }
}
