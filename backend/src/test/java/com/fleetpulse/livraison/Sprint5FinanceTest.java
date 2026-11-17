package com.fleetpulse.livraison;

import static org.junit.jupiter.api.Assertions.*;
import com.fleetpulse.livraison.Repository.FinanceCommandeRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import tools.jackson.databind.JsonNode;

/**
 * Sprint 5 (base H2) : commission et ledger a la livraison (US-501, US-502, US-503), caisse du livreur (US-504),
 * depot integral avec recu (US-505), closing hebdomadaire des reversements et des remunerations (US-506, US-512).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=jdbc:h2:mem:sprint5finance;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
        "app.sprint2.donnees-demo=false", "app.commandes.intervalle-secondes=0", "app.commandes.actives-max=10" })
class Sprint5FinanceTest extends ParcoursSprint3 {
    @Autowired FinanceCommandeRepository finances;

    /** Commande de 2 x 6 DT + 3 DT de frais, collectee puis remise contre 15 DT et le QR du client. */
    long livrer(Coursier c) throws Exception {
        long id = commandeCollectee(c);
        String qr = succes(200, appel("GET", "/commandes/" + id + "/qr-remise", null, client)).get("contenuQr").asText();
        assertEquals("LIVREE", succes(200, appel("POST", "/livreur/missions/" + id + "/remise",
                Map.of("montantEncaisse", 15, "preuve", qr), c.token())).get("statut").asText());
        return id;
    }
    JsonNode finance(long commande) throws Exception { return succes(200, appel("GET", "/admin/finance/commandes/" + commande, null, admin)); }
    JsonNode caisse(Coursier c) throws Exception { return succes(200, appel("GET", "/livreur/caisse", null, c.token())); }
    static List<JsonNode> liste(JsonNode tableau) { return StreamSupport.stream(tableau.spliterator(), false).toList(); }

    @Test void livraisonDepotEtClosingHebdomadaire() throws Exception {
        succes(200, appel("PUT", "/admin/finance/baremes/" + zoneA, Map.of("base", 4, "parKm", 0), admin));
        Coursier sami = coursierDisponible("Sami");

        // US-501 / US-503 : commission par defaut 12 %, net partenaire, cash et remuneration, ecritures immuables
        long a = livrer(sami);
        JsonNode fa = finance(a);
        assertEquals(12.0, fa.get("montantArticles").asDouble(), 1e-9);
        assertEquals(12.0, fa.get("tauxCommission").asDouble(), 1e-9);
        assertEquals(1.44, fa.get("commission").asDouble(), 1e-9);
        assertEquals(10.56, fa.get("netPartenaire").asDouble(), 1e-9);
        assertEquals(3.0, fa.get("fraisLivraison").asDouble(), 1e-9);
        assertEquals(15.0, fa.get("montantEncaisse").asDouble(), 1e-9);
        assertEquals(4.0, fa.get("remunerationCoursier").asDouble(), 1e-9);
        assertEquals(Set.of("GMV", "COMMISSION", "NET_PARTENAIRE", "FRAIS_LIVRAISON", "CASH_COURSIER", "REMUNERATION_COURSIER"),
                new HashSet<>(liste(fa.get("ecritures")).stream().map(e -> e.get("type").asText()).toList()));

        // US-502 : taux propre au partenaire pour la suite ; la commande deja livree garde son taux
        succes(200, appel("PUT", "/admin/finance/commissions", Map.of("portee", "PARTENAIRE", "partenaireId", partenaireId, "taux", 10), admin));
        long b = livrer(sami);
        assertEquals(1.2, finance(b).get("commission").asDouble(), 1e-9);
        assertEquals(1.44, finance(a).get("commission").asDouble(), 1e-9);

        // US-504 : le livreur voit son cash a deposer et ses missions pas encore payees
        JsonNode avant = caisse(sami);
        assertEquals(30.0, avant.get("solde").asDouble(), 1e-9);
        assertEquals(2, avant.get("commandes").size());
        assertEquals(8.0, avant.get("remunerationEnAttente").asDouble(), 1e-9);

        // US-505 : depot integral, ecart motive, recu, rejeu idempotent
        String cle = UUID.randomUUID().toString();
        assertEquals(400, appel("POST", "/admin/finance/depots", Map.of("livreurId", sami.id(), "montantRecu", 29, "cleIdempotence", cle), admin).status());
        JsonNode recu = succes(201, appel("POST", "/admin/finance/depots", Map.of("livreurId", sami.id(), "montantRecu", 30, "cleIdempotence", cle), admin));
        assertEquals("RAPPROCHE", recu.get("statut").asText());
        assertEquals(2, recu.get("nbCommandes").asInt());
        assertTrue(recu.get("numeroRecu").asText().startsWith("RC-"));
        assertEquals(recu.get("numeroRecu").asText(), succes(201, appel("POST", "/admin/finance/depots",
                Map.of("livreurId", sami.id(), "montantRecu", 30, "cleIdempotence", cle), admin)).get("numeroRecu").asText(), "rejeu");
        JsonNode apres = caisse(sami);
        assertEquals(0.0, apres.get("solde").asDouble(), 1e-9);
        assertEquals(1, apres.get("recus").size());
        assertEquals(409, appel("POST", "/admin/finance/depots",
                Map.of("livreurId", sami.id(), "montantRecu", 0, "cleIdempotence", UUID.randomUUID().toString()), admin).status());
        assertTrue(liste(succes(200, appel("GET", "/admin/finance/caisses", null, admin)).get("coursiers")).stream()
                .noneMatch(c -> c.get("livreurId").asLong() == sami.id()));

        // US-506 / US-512 : les livraisons datent de la semaine derniere, qui peut etre close
        for (long id : List.of(a, b)) {
            var f = finances.findByCommandeId(id).orElseThrow();
            f.setLivreeLe(Instant.now().minusSeconds(8 * 86_400));
            finances.save(f);
        }
        LocalDate semaine = LocalDate.now(ZoneId.of("Africa/Tunis")).minusWeeks(1);
        JsonNode apercu = succes(200, appel("GET", "/admin/finance/closings/apercu?semaine=" + semaine, null, admin));
        assertTrue(apercu.get("id").isNull());
        JsonNode releve = liste(apercu.get("partenaires")).stream().filter(p -> p.get("partenaireId").asLong() == partenaireId).findFirst().orElseThrow();
        assertEquals(21.36, releve.get("net").asDouble(), 1e-9);
        assertEquals(2, releve.get("nbCommandes").asInt());

        JsonNode closing = succes(201, appel("POST", "/admin/finance/closings", Map.of("semaine", semaine.toString()), admin));
        assertFalse(closing.get("id").isNull());
        assertEquals(409, appel("POST", "/admin/finance/closings", Map.of("semaine", semaine.toString()), admin).status(), "deja close");
        assertEquals(409, appel("POST", "/admin/finance/closings", Map.of("semaine", LocalDate.now().plusWeeks(1).toString()), admin).status(),
                "semaine pas terminee");

        JsonNode detail = finance(a);
        assertFalse(detail.get("closingPartenaireId").isNull());
        assertTrue(detail.get("numeroRecu").asText().startsWith("RC-"));
        Set<String> types = new HashSet<>(liste(detail.get("ecritures")).stream().map(e -> e.get("type").asText()).toList());
        assertTrue(types.containsAll(Set.of("DEPOT_CASH", "REVERSEMENT_PARTENAIRE", "PAIEMENT_COURSIER")), types.toString());

        JsonNode fin = caisse(sami);
        assertEquals(0, fin.get("missionsEnAttente").asInt());
        assertEquals(8.0, fin.get("releves").get(0).get("remuneration").asDouble(), 1e-9);
    }

    @Test void financeReserveeAuSousRoleFinance() throws Exception {
        String ops = UUID.randomUUID() + "@sprint5.test", fin = UUID.randomUUID() + "@sprint5.test";
        assertEquals(201, appel("POST", "/admin/responsables", Map.of("nom", "Test", "prenom", "Ops", "email", ops,
                "motDePasse", "test-ops-password", "sousRole", "OPERATIONS"), admin).status());
        assertEquals(201, appel("POST", "/admin/responsables", Map.of("nom", "Test", "prenom", "Finance", "email", fin,
                "motDePasse", "test-finance-password", "sousRole", "FINANCE"), admin).status());
        String tokenOps = login(ops, "test-ops-password"), tokenFinance = login(fin, "test-finance-password");

        assertEquals(403, appel("GET", "/admin/finance/caisses", null, tokenOps).status());
        assertEquals(200, appel("GET", "/admin/finance/caisses", null, tokenFinance).status());
        assertEquals(200, appel("GET", "/admin/finance/commissions", null, tokenFinance).status());
        assertEquals(403, appel("GET", "/admin/dispatch", null, tokenFinance).status());
        assertEquals(403, appel("GET", "/admin/finance/ledger", null, client).status());
        assertEquals(403, appel("GET", "/livreur/caisse", null, client).status());
        assertEquals(400, appel("PUT", "/admin/finance/commissions", Map.of("portee", "GLOBAL", "taux", 120), tokenFinance).status());
    }
}
