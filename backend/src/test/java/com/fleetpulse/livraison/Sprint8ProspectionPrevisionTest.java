package com.fleetpulse.livraison;

import static org.junit.jupiter.api.Assertions.*;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

/** Sprint 8 : prospection (US-801 a US-803), prevision de demande (US-804, US-805) et export IA (US-806). */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=jdbc:h2:mem:sprint8prospection;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
        "app.sprint2.donnees-demo=false", "app.commandes.intervalle-secondes=0", "app.commandes.actives-max=10" })
class Sprint8ProspectionPrevisionTest extends ParcoursSprint3 {

    Map<String, Object> ligne(String nom, String categorie, double lat, double lng) {
        return Map.of("nom", nom, "categorie", categorie, "adresse", "Rue test", "latitude", lat, "longitude", lng);
    }

    @Test void importSourceAutoriseeEtLignesInvalidesSignalees() throws Exception {
        succes(400, appel("POST", "/admin/prospects/import",
                Map.of("source", "SCRAPING_SITE", "lignes", List.of(ligne("Boulangerie Test", "BOULANGERIE", 36.8, 10.18))), admin));

        var vue = succes(201, appel("POST", "/admin/prospects/import", Map.of("source", "REGISTRE_COMMERCE", "lignes", List.of(
                ligne("Boulangerie Test", "BOULANGERIE", 36.8, 10.18),
                ligne("", "RESTAURANT", 36.8, 10.18),
                ligne("Pharmacie Hors Limites", "PHARMACIE", 120, 10.18)
        )), admin));
        assertEquals(1, vue.get("crees").asInt());
        assertEquals(2, vue.get("erreurs").size(), "une ligne sans nom, une latitude hors limites : signalées, sans bloquer l'import");
    }

    @Test void scoreStatutEtListeTriee() throws Exception {
        succes(201, appel("POST", "/admin/prospects/import", Map.of("source", "SAISIE_TERRAIN", "lignes", List.of(
                ligne("Restaurant Alpha", "RESTAURANT", 36.80, 10.18),
                ligne("Épicerie Beta", "EPICERIE", 36.90, 10.30))), admin));
        // La base est partagee entre les tests de la classe : on ne compte pas en absolu.
        assertTrue(succes(200, appel("POST", "/admin/prospects/scoring", null, admin)).asInt() >= 2);

        var liste = succes(200, appel("GET", "/admin/prospects", null, admin));
        assertTrue(liste.size() >= 2);
        assertTrue(liste.get(0).get("score").asDouble() >= liste.get(1).get("score").asDouble(), "trié par score décroissant");
        assertEquals("A_CONTACTER", liste.get(0).get("statut").asText());
        long id = liste.get(0).get("id").asLong();

        succes(409, appel("PUT", "/admin/prospects/" + id + "/statut", Map.of("statut", "INSCRIT"), admin));
        succes(200, appel("PUT", "/admin/prospects/" + id + "/statut", Map.of("statut", "CONTACTE"), admin));
        succes(400, appel("PUT", "/admin/prospects/" + id + "/statut", Map.of("statut", "REFUSE"), admin));
        var refus = succes(200, appel("PUT", "/admin/prospects/" + id + "/statut",
                Map.of("statut", "REFUSE", "commentaire", "Pas intéressé pour l'instant"), admin));
        assertEquals("REFUSE", refus.get("statut").asText());
        succes(409, appel("PUT", "/admin/prospects/" + id + "/statut", Map.of("statut", "CONTACTE"), admin));

        var jeu = succes(200, appel("GET", "/admin/prospects/jeu", null, admin));
        assertEquals(1, jeu.size(), "seul le prospect à issue connue entre dans le jeu d'entraînement");
        assertFalse(jeu.get(0).get("converti").asBoolean());
    }

    @Test void previsionEtExportIaCouvrentTousLesCreneaux() throws Exception {
        var previsions = succes(200, appel("GET", "/admin/previsions?jour=2026-11-23", null, admin));
        var demande = succes(200, appel("GET", "/admin/previsions/jeu-demande", null, admin));
        java.util.Set<String> zonesDistinctes = new java.util.HashSet<>();
        demande.forEach(ligne -> zonesDistinctes.add(ligne.get("zoneId").asText()));
        long zones = zonesDistinctes.size();
        assertEquals(zones * 13, previsions.size(), "13 créneaux ouverts (10 h à 22 h) par zone");
        assertEquals("moyenne-historique", previsions.get(0).get("source").asText(), "sans service d'IA : repli documenté");
        assertTrue(previsions.get(0).get("commandesPrevues").asDouble() >= 0);

        var export = succes(200, appel("GET", "/admin/entrepot/export-ia", null, admin));
        assertTrue(export.has("eta") && export.has("demande") && export.has("prospection"));
        assertFalse(export.get("demande").isEmpty());
        assertFalse(export.get("demande").get(0).has("clientId"), "aucune donnée personnelle de client");
        assertFalse(export.toString().contains("@"), "aucun e-mail dans les exports");
    }

    @Test void alertesDeSousCouvertureAvecRenfort() throws Exception {
        var alertes = succes(200, appel("GET", "/admin/previsions/alertes?jour=2026-11-23", null, admin));
        for (var a : alertes) {
            assertTrue(a.get("commandesPrevues").asDouble() > a.get("capaciteCommandes").asDouble());
            assertTrue(a.get("renfortRecommande").asInt() >= 1);
        }
    }

    @Test void droitsOperationsRefuses() throws Exception {
        succes(403, appel("GET", "/admin/prospects", null, client));
        succes(403, appel("GET", "/admin/previsions", null, client));
    }
}
