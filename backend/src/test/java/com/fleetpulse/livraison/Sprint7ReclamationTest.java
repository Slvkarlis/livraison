package com.fleetpulse.livraison;

import static org.junit.jupiter.api.Assertions.*;
import com.fleetpulse.livraison.Model.EcritureLedger;
import com.fleetpulse.livraison.Model.enums.TypeEcriture;
import com.fleetpulse.livraison.Repository.LivraisonRepository;
import com.fleetpulse.livraison.Repository.EcritureLedgerRepository;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

/** Sprint 7 : reclamation du client apres livraison (US-516) et decision de la finance inscrite au ledger (US-517). */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=jdbc:h2:mem:sprint7reclamation;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
        "app.sprint2.donnees-demo=false", "app.commandes.intervalle-secondes=0", "app.commandes.actives-max=10" })
class Sprint7ReclamationTest extends ParcoursSprint3 {
    @Autowired LivraisonRepository livraisons;
    @Autowired EcritureLedgerRepository ledger;

    /** Commande livree (remise par QR) : id. */
    long commandeLivree(Coursier c) throws Exception {
        long id = commandeCollectee(c);
        String qr = succes(200, appel("GET", "/commandes/" + id + "/qr-remise", null, client)).get("contenuQr").asText();
        Map<String, Object> corps = new HashMap<>();
        corps.put("montantEncaisse", 15.000);
        corps.put("preuve", qr);
        succes(200, appel("POST", "/livreur/missions/" + id + "/remise", corps, c.token()));
        return id;
    }

    Reponse reclamer(long commande, String type, String description, Object montant) throws Exception {
        Map<String, Object> corps = new HashMap<>();
        corps.put("commandeId", commande);
        corps.put("type", type);
        corps.put("description", description);
        corps.put("montantDemande", montant);
        return appel("POST", "/reclamations", corps, client);
    }

    Reponse decider(long reclamation, Object montant, String imputation) throws Exception {
        Map<String, Object> corps = new HashMap<>();
        corps.put("montantRembourse", montant);
        corps.put("imputation", imputation);
        corps.put("commentaire", "Vérifié avec le partenaire");
        return appel("POST", "/admin/finance/reclamations/" + reclamation + "/decision", corps, admin);
    }

    @Test void ouvertureBorneeEtUneSeuleParCommande() throws Exception {
        Coursier sami = coursierDisponible("Sami");
        long livree = commandeLivree(sami);
        long enCours = commandeCollectee(sami);

        succes(409, reclamer(enCours, "QUALITE", "Produit abîmé à la réception", 5));
        succes(400, reclamer(livree, "QUALITE", "court", 5));
        succes(400, reclamer(livree, "QUALITE", "Un article manquait dans le sac", 999));
        var vue = succes(201, reclamer(livree, "ARTICLE_MANQUANT", "Un article manquait dans le sac", 5));
        assertEquals("OUVERTE", vue.get("statut").asText());
        succes(409, reclamer(livree, "QUALITE", "Deuxième tentative sur la même commande", 5));
    }

    @Test void remboursementImputeAuPartenaireAuLedger() throws Exception {
        Coursier sami = coursierDisponible("Sami");
        long id = commandeLivree(sami);
        long rec = succes(201, reclamer(id, "ARTICLE_MANQUANT", "Un article manquait dans le sac", 5)).get("id").asLong();

        succes(400, decider(rec, 6, "PARTENAIRE"));
        succes(400, decider(rec, 3, null));
        var traitee = succes(200, decider(rec, 3, "PARTENAIRE"));
        assertEquals("RESOLUE", traitee.get("statut").asText());
        assertEquals(0, traitee.get("montantRembourse").decimalValue().compareTo(new java.math.BigDecimal("3")));
        succes(409, decider(rec, 3, "PARTENAIRE"));

        List<EcritureLedger> ecritures = ledger.findAll().stream().filter(e -> id == e.getCommandeId()).toList();
        assertTrue(ecritures.stream().anyMatch(e -> e.getType() == TypeEcriture.REMBOURSEMENT && e.getMontant().compareTo(new java.math.BigDecimal("3.000")) == 0));
        assertTrue(ecritures.stream().anyMatch(e -> e.getType() == TypeEcriture.COMPENSATION && e.getPartenaireId() != null));
    }

    @Test void rejetSansEcriture() throws Exception {
        Coursier sami = coursierDisponible("Sami");
        long id = commandeLivree(sami);
        long rec = succes(201, reclamer(id, "QUALITE", "Le pain était froid à la livraison", 4)).get("id").asLong();
        var vue = succes(200, decider(rec, 0, null));
        assertEquals("REJETEE", vue.get("statut").asText());
        assertTrue(ledger.findAll().stream().noneMatch(e -> id == e.getCommandeId() && e.getType() == TypeEcriture.REMBOURSEMENT));
    }

    @Test void droitsCroises() throws Exception {
        Coursier sami = coursierDisponible("Sami");
        long id = commandeLivree(sami);
        long rec = succes(201, reclamer(id, "QUALITE", "Le pain était froid à la livraison", 4)).get("id").asLong();
        succes(403, appel("POST", "/admin/finance/reclamations/" + rec + "/decision", Map.of("montantRembourse", 0), client));
        succes(403, appel("POST", "/reclamations", Map.of("commandeId", id), admin));
    }
}
