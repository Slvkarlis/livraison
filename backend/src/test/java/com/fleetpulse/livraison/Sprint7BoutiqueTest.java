package com.fleetpulse.livraison;

import static org.junit.jupiter.api.Assertions.*;
import com.fleetpulse.livraison.Model.Livraison;
import com.fleetpulse.livraison.Repository.LivraisonRepository;
import com.fleetpulse.livraison.Service.ExpirationCommandeService;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

/** Sprint 7 : horaires, pause, expiration des commandes sans reponse et pause automatique (US-2B6). */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=jdbc:h2:mem:sprint7boutique;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
        "app.sprint2.donnees-demo=false", "app.commandes.intervalle-secondes=0", "app.commandes.actives-max=50",
        "app.commandes.verification-expiration-ms=3600000" })
class Sprint7BoutiqueTest extends ParcoursSprint3 {
    @Autowired ExpirationCommandeService expirations;
    @Autowired LivraisonRepository livraisons;

    /** Commande passee, non acceptee : reste PENDING_PARTNER. */
    long commandeEnAttente() throws Exception {
        Map<String, Object> panier = new HashMap<>(Map.of("partenaireId", partenaireId, "adresseId", adresseId,
                "lignes", List.of(Map.of("produitId", produitId, "quantite", 1)), "notes", ""));
        panier.put("devisEmpreinte", succes(200, appel("POST", "/commandes/devis", panier, client)).get("empreinte").asText());
        panier.put("cleIdempotence", UUID.randomUUID().toString());
        return succes(201, appel("POST", "/commandes", panier, client)).get("id").asLong();
    }

    void reinitialiser() throws Exception {
        succes(200, appel("DELETE", "/partenaire/boutique/pause", null, partenaire));
        succes(200, appel("PUT", "/partenaire/boutique/horaires", Map.of("jours", List.of(1, 2, 3, 4, 5, 6, 7)), partenaire));
    }

    @Test void pauseBloqueLesCommandesEtSeLeve() throws Exception {
        succes(400, appel("POST", "/partenaire/boutique/pause", Map.of("minutes", 5), partenaire));
        var etat = succes(200, appel("POST", "/partenaire/boutique/pause", Map.of("minutes", 60), partenaire));
        assertFalse(etat.get("acceptePourCommandes").asBoolean());
        succes(409, appel("POST", "/commandes/devis", Map.of("partenaireId", partenaireId, "adresseId", adresseId,
                "lignes", List.of(Map.of("produitId", produitId, "quantite", 1))), client));
        succes(200, appel("DELETE", "/partenaire/boutique/pause", null, partenaire));
        assertTrue(succes(200, appel("GET", "/partenaire/boutique", null, partenaire)).get("acceptePourCommandes").asBoolean());
    }

    @Test void horairesFermesAujourdhuiBloquent() throws Exception {
        int aujourdhui = LocalDate.now(ZoneId.of("Africa/Tunis")).getDayOfWeek().getValue();
        List<Integer> autres = java.util.stream.IntStream.rangeClosed(1, 7).filter(j -> j != aujourdhui).boxed().toList();
        succes(400, appel("PUT", "/partenaire/boutique/horaires", Map.of("ouverture", "09:00", "fermeture", "09:00", "jours", autres), partenaire));
        succes(400, appel("PUT", "/partenaire/boutique/horaires", Map.of("ouverture", "25:00", "fermeture", "22:00", "jours", autres), partenaire));
        succes(200, appel("PUT", "/partenaire/boutique/horaires", Map.of("ouverture", "09:00", "fermeture", "22:00", "jours", autres), partenaire));
        assertFalse(succes(200, appel("GET", "/partenaire/boutique", null, partenaire)).get("acceptePourCommandes").asBoolean());
        reinitialiser();
    }

    @Test void commandeSansReponseExpireEtTroisExpirationsMettentEnPause() throws Exception {
        reinitialiser();
        long premiere = commandeEnAttente();
        long deuxieme = commandeEnAttente();
        commandeEnAttente();
        Instant bientot = Instant.now().plusSeconds(3600);   // au-dela du delai de 2 minutes

        assertTrue(expirations.expirerAvant(bientot) >= 3);
        Livraison c = livraisons.findById(premiere).orElseThrow();
        assertEquals("REFUSEE", c.getStatut().name());
        assertEquals("EXPIREE", c.getMotifRefus().name());
        var etat = succes(200, appel("GET", "/partenaire/boutique", null, partenaire));
        assertFalse(etat.get("pauseJusqua").isNull(), "trois expirations consecutives : pause automatique");
        assertFalse(etat.get("acceptePourCommandes").asBoolean());
        assertEquals(0, etat.get("expirationsConsecutives").asInt(), "compteur remis a zero après la pause");

        // Le motif EXPIREE est pose par le systeme : le partenaire ne peut pas le choisir.
        succes(400, appel("PUT", "/partenaire/commandes/" + deuxieme + "/refuser",
                Map.of("motif", "EXPIREE"), partenaire));
        reinitialiser();
    }
}
