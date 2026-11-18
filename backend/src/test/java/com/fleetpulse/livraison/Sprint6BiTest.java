package com.fleetpulse.livraison;

import static org.junit.jupiter.api.Assertions.*;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.*;
import com.fleetpulse.livraison.Repository.*;
import com.fleetpulse.livraison.Service.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
    "spring.datasource.url=jdbc:h2:mem:sprint6bi;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
    "app.sprint2.donnees-demo=false", "app.commandes.intervalle-secondes=0", "app.commandes.actives-max=10" })
class Sprint6BiTest extends ParcoursSprint3 {
    @Autowired LivraisonRepository commandes;
    @Autowired PartenaireRepository partenaires;
    @Autowired LivreurRepository livreurs;
    @Autowired ComptabiliteService comptabilite;
    @Autowired BiRepository agregats;
    @Autowired FinanceCommandeRepository finances;
    @Autowired DepotCashRepository depots;

    Livraison livree(Coursier coursier, Instant date) {
        Livraison c = new Livraison();
        c.setCodeSuivi("BI-" + UUID.randomUUID()); c.setAdresse("Adresse démo");
        c.setLatitude(latClient); c.setLongitude(lngClient);
        c.setCreneauDebut(date); c.setCreneauFin(date.plusSeconds(3600)); c.setDateCreation(date.minusSeconds(1800));
        c.setClient((Client) utilisateurs.findByEmail(clientEmail).orElseThrow());
        c.setPartenaire(partenaires.findById(partenaireId).orElseThrow()); c.setNomPartenaire("Commerce BI");
        c.setLivreur(livreurs.findById(coursier.id()).orElseThrow());
        c.setStatut(StatutLivraison.LIVREE); c.setTempsPreparationMinutes(10);
        c.setAccepteeLe(date.minusSeconds(1800)); c.setPreteLe(date.minusSeconds(1080));
        c.setRecupereeLe(date.minusSeconds(900)); c.setLivreeLe(date); c.setPromesseLivraison(date.plusSeconds(60));
        c.setMontantArticles(new BigDecimal("12.000")); c.setFraisLivraison(3); c.setTotal(new BigDecimal("15.000"));
        c.setMontantEncaisse(new BigDecimal("15.000"));
        LigneCommande ligne = new LigneCommande(); ligne.setCommande(c); ligne.setProduit(new Produit()); ligne.getProduit().setId(produitId);
        ligne.setNomProduit("Brik"); ligne.setPrixUnitaire(new BigDecimal("6.000")); ligne.setQuantite(2); ligne.setSousTotal(new BigDecimal("12.000"));
        c.getLignes().add(ligne);
        c = commandes.save(c); comptabilite.comptabiliser(c); return c;
    }
    String periode() { String jour = LocalDate.now(ZoneId.of("Africa/Tunis")).toString(); return "?debut=" + jour + "&fin=" + jour; }

    @Test void financeSeRecoupeAvecLeLedgerEtLesDepots() throws Exception {
        Coursier coursier = coursier("BI");
        succes(200, appel("PUT", "/admin/finance/baremes/" + zoneA, Map.of("base", 4, "parKm", 0), admin));
        var commande = livree(coursier, Instant.now());
        var d = succes(200, appel("GET", "/admin/finance/bi" + periode(), null, admin));
        // Les tests partagent la base : comparer le delta n'est pas nécessaire ici, la finance est le premier et seul jeu comptabilisé par ce test.
        assertEquals(12, d.get("gmv").asDouble(), 1e-9);
        assertEquals(1.44, d.get("commissionsNettes").asDouble(), 1e-9);
        assertEquals(-1, d.get("margeLivraison").asDouble(), 1e-9);
        assertEquals(15, d.get("cashEnCirculation").asDouble(), 1e-9);
        assertEquals(0, d.get("reversementsAEffectuer").asDouble(), 1e-9);
        assertEquals(4, d.get("remunerationsAEffectuer").asDouble(), 1e-9);
        assertEquals(2, d.get("articlesVendus").asInt());
        var p = PeriodeBi.de(null, null);
        var sommes = new EnumMap<TypeEcriture, BigDecimal>(TypeEcriture.class);
        for (Object[] r : agregats.ledger(p)) sommes.put((TypeEcriture) r[0], (BigDecimal) r[1]);
        assertEquals(sommes.get(TypeEcriture.GMV).doubleValue(), d.get("gmv").asDouble());
        assertEquals(sommes.get(TypeEcriture.COMMISSION).doubleValue(), d.get("commissionsNettes").asDouble());
        succes(201, appel("POST", "/commandes/" + commande.getId() + "/notations", Map.of("cible", "LIVREUR", "note", 4), client));
        succes(201, appel("POST", "/commandes/" + commande.getId() + "/notations", Map.of("cible", "LIVREUR", "note", 5), partenaire));
        var coursiers = succes(200, appel("GET", "/admin/bi/coursiers" + periode() + "&zoneId=" + zoneA, null, admin));
        var coursierBi = coursiers.get("coursiers").get(0);
        assertEquals(1, coursierBi.get("missions").asInt());
        double km = finances.findByCommandeId(commande.getId()).orElseThrow().getDistanceKm();
        assertEquals(Math.round(15.0 / km * 1000) / 1000.0, coursierBi.get("minutesParKm").asDouble(), 1e-6);
        assertEquals(100, coursierBi.get("respectEtaPourcent").asDouble()); assertEquals(1, coursierBi.get("etaMesurables").asInt());
        assertTrue(coursierBi.get("delaiDepotHeures").isNull()); assertEquals(1, coursierBi.get("missionsNonDeposees").asInt());
        assertEquals(4.5, coursierBi.get("noteMoyenne").asDouble());
        assertEquals(1, coursiers.get("zones").get(0).get("livraisonsParJour").asDouble());
        assertEquals(1, coursiers.get("zones").get(0).get("missionsParCoursier").asDouble());
        succes(201, appel("POST", "/admin/finance/depots", Map.of("livreurId", coursier.id(), "montantRecu", 14,
                "motifEcart", "Manque de monnaie", "cleIdempotence", UUID.randomUUID().toString()), admin));
        var depot = finances.findByCommandeId(commande.getId()).orElseThrow().getDepot();
        depot.setDate(commande.getLivreeLe().plusSeconds(7200)); depots.save(depot);
        coursierBi = succes(200, appel("GET", "/admin/bi/coursiers" + periode() + "&zoneId=" + zoneA, null, admin)).get("coursiers").get(0);
        assertEquals(2, coursierBi.get("delaiDepotHeures").asDouble()); assertEquals(1, coursierBi.get("depotsMesures").asInt());
        assertEquals(1, coursierBi.get("ecartsDepot").asInt()); assertEquals(0, coursierBi.get("missionsNonDeposees").asInt());
        d = succes(200, appel("GET", "/admin/finance/bi" + periode(), null, admin));
        assertEquals(0, d.get("cashEnCirculation").asDouble());
        assertEquals(10.56, d.get("reversementsAEffectuer").asDouble(), 1e-9);
        var vide = succes(200, appel("GET", "/admin/finance/bi?debut=2000-01-01&fin=2000-01-02", null, admin));
        assertEquals(0, vide.get("gmv").asDouble());
        assertEquals(400, appel("GET", "/admin/finance/bi?debut=2026-02-01&fin=2026-01-01", null, admin).status());
        assertEquals(400, appel("GET", "/admin/finance/bi?debut=2000-01-01&fin=2026-01-01", null, admin).status());
        assertEquals(403, appel("GET", "/admin/finance/bi", null, client).status());
        var ventes = succes(200, appel("GET", "/partenaire/ventes" + periode(), null, partenaire));
        assertEquals(12, ventes.get("chiffreAffaires").asDouble()); assertEquals(1, ventes.get("commandes").asInt());
        assertEquals(2, ventes.get("meilleursProduits").get(0).get("quantite").asInt());
        assertEquals(12, ventes.get("meilleursProduits").get(0).get("chiffreAffaires").asDouble());
        Instant hier = LocalDate.now(ZoneId.of("Africa/Tunis")).atStartOfDay(ZoneId.of("Africa/Tunis")).toInstant().minusSeconds(1);
        livree(coursier, hier);
        assertEquals(1, succes(200, appel("GET", "/partenaire/ventes" + periode(), null, partenaire)).get("commandes").asInt(), "borne Tunis exclusive");
        Partenaire autre = new Partenaire(); autre.setNom("Test"); autre.setPrenom("Autre"); autre.setNomCommerce("Autre commerce");
        autre.setEmail(UUID.randomUUID() + "@bi.test"); autre.setRole(Role.PARTENAIRE); autre.setMotDePasseHash(encoder.encode("autre-partenaire-password"));
        utilisateurs.save(autre);
        String autreToken = login(autre.getEmail(), "autre-partenaire-password");
        var isolement = succes(200, appel("GET", "/partenaire/ventes" + periode() + "&partenaireId=" + partenaireId, null, autreToken));
        assertEquals(0, isolement.get("chiffreAffaires").asDouble(), "un paramètre forgé n'élargit pas le périmètre serveur");
        assertEquals(0, isolement.get("meilleursProduits").size());
        assertEquals(403, appel("GET", "/partenaire/ventes", null, client).status());
        assertEquals(403, appel("GET", "/partenaire/ventes", null, coursier.token()).status());
        assertEquals(403, appel("GET", "/partenaire/ventes", null, admin).status());
    }
}
