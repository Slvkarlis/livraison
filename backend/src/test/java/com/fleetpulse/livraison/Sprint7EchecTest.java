package com.fleetpulse.livraison;

import static org.junit.jupiter.api.Assertions.*;
import com.fleetpulse.livraison.Model.Livraison;
import com.fleetpulse.livraison.Repository.LivraisonRepository;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

/** Sprint 7 : echec de livraison declare par le coursier (US-308) puis decide par le responsable (US-312). */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=jdbc:h2:mem:sprint7echec;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
        "app.sprint2.donnees-demo=false", "app.commandes.intervalle-secondes=0", "app.commandes.actives-max=10" })
class Sprint7EchecTest extends ParcoursSprint3 {
    @Autowired LivraisonRepository livraisons;

    Reponse echec(Coursier c, long id, Object motif, String commentaire) throws Exception {
        Map<String, Object> corps = new HashMap<>();
        corps.put("motif", motif);
        corps.put("commentaire", commentaire);
        return appel("POST", "/livreur/missions/" + id + "/echec", corps, c.token());
    }

    Reponse decision(long id, String decision, String commentaire) throws Exception {
        Map<String, Object> corps = new HashMap<>();
        corps.put("decision", decision);
        corps.put("commentaire", commentaire);
        return appel("POST", "/admin/echecs/" + id + "/decision", corps, admin);
    }

    @Test void declarationAvecMotifPuisRejeu() throws Exception {
        Coursier sami = coursierDisponible("Sami");
        long id = commandeCollectee(sami);

        assertTrue(succes(400, echec(sami, id, null, null)).get("message").asText().contains("motif"));
        assertTrue(succes(400, echec(sami, id, "INCIDENT", "abc")).get("message").asText().contains("5 caractères"),
                "un incident exige une description");

        var mission = succes(200, echec(sami, id, "INJOIGNABLE", "  sonné trois fois  "));
        assertEquals("ECHEC", mission.get("statut").asText());
        var c = livraisons.findById(id).orElseThrow();
        assertEquals("sonné trois fois", c.getCommentaireEchec(), "commentaire nettoyé");
        assertNotNull(c.getEchecLe());

        assertEquals("ECHEC", succes(200, echec(sami, id, "REFUS_PAIEMENT", null)).get("statut").asText(),
                "rejeu reseau sans effet, motif initial conservé");
        assertEquals("INJOIGNABLE", livraisons.findById(id).orElseThrow().getMotifEchec().name());
    }

    @Test void seulLeLivreurAffecteDeclare() throws Exception {
        Coursier sami = coursierDisponible("Sami");
        Coursier autre = coursierDisponible("Autre");
        long id = commandeCollectee(sami);

        succes(404, echec(autre, id, "INJOIGNABLE", null));
        succes(404, echec(sami, commandePrete().get("id").asLong(), "INJOIGNABLE", null)); // non affectée à Sami : introuvable pour lui
    }

    @Test void relivraisonRepasseEnRecuperee() throws Exception {
        Coursier sami = coursierDisponible("Sami");
        long id = commandeCollectee(sami);
        succes(200, echec(sami, id, "ADRESSE_INTROUVABLE", null));

        assertEquals("RECUPEREE", succes(200, decision(id, "RELIVRAISON", "Nouvelle tentative demain")).get("statut").asText());
        assertEquals("RELIVRAISON", livraisons.findById(id).orElseThrow().getDecisionEchec().name());
        succes(409, decision(id, "PERTE", null)); // une seule decision
    }

    @Test void retourAuPartenaireEtPerte() throws Exception {
        Coursier sami = coursierDisponible("Sami");
        long retour = commandeCollectee(sami);
        succes(200, echec(sami, retour, "REFUS_MARCHANDISE", null));
        assertEquals("RETOURNEE", succes(200, decision(retour, "RETOUR_PARTENAIRE", null)).get("statut").asText());

        long perdu = commandeCollectee(sami);
        succes(200, echec(sami, perdu, "INCIDENT", "Colis tombé de la moto"));
        var vue = succes(200, decision(perdu, "PERTE", "Déclaré par le coursier"));
        assertEquals("ECHEC", vue.get("statut").asText(), "la perte reste un echec trace");
        assertEquals("PERTE", vue.get("decision").asText());
        assertTrue(succes(200, appel("GET", "/admin/echecs", null, admin)).size() >= 2);
    }

    @Test void decisionRefuseeHorsEchecEtPourClient() throws Exception {
        Coursier sami = coursierDisponible("Sami");
        long id = commandeCollectee(sami);
        succes(409, decision(id, "RELIVRAISON", null));
        succes(403, appel("POST", "/admin/echecs/" + id + "/decision",
                Map.of("decision", "PERTE"), client));
    }
}
