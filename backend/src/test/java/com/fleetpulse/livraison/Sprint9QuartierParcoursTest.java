package com.fleetpulse.livraison;

import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Repository.*;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import com.fleetpulse.livraison.Service.PasserelleCarteQuartier;
import java.math.BigDecimal;
import static org.mockito.Mockito.*;
import tools.jackson.databind.JsonNode;
import static org.junit.jupiter.api.Assertions.*;

/** Vrai serveur HTTP, JWT et base H2 isolée : trois voisins jusqu'aux trois remises. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=jdbc:h2:mem:sprint9;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
        "app.sprint2.donnees-demo=false", "app.commandes.intervalle-secondes=0", "app.commandes.actives-max=20",
        "app.dispatch.par-lots=true", "app.dispatch.planificateur=false", "app.dispatch.fenetre-regroupement-secondes=30" })
class Sprint9QuartierParcoursTest extends ParcoursSprint3 {
    @Autowired GroupeQuartierRepository groupes;
    @Autowired LivraisonRepository commandes;
    @Autowired InvitationQuartierRepository invitations;
    @Autowired ConfigurationQuartierRepository configurations;
    @MockitoBean PasserelleCarteQuartier carte;

    record Voisin(String token, long adresse) { }
    Voisin voisin(int n) throws Exception {
        String token = login(nouveauClient("Voisin " + n, null), "client-password");
        long adresse = succes(201, appel("POST", "/adresses", Map.of("libelle", "Maison", "adresse", "Adresse privée " + n,
                "latitude", latClient + n * .0002, "longitude", lngClient), token)).get("id").asLong();
        return new Voisin(token, adresse);
    }
    JsonNode passer(Voisin v) throws Exception {
        return passer(v, "COD");
    }
    JsonNode passer(Voisin v, String mode) throws Exception {
        Map<String, Object> panier = new HashMap<>(Map.of("partenaireId", partenaireId, "adresseId", v.adresse(),
                "lignes", List.of(Map.of("produitId", produitId, "quantite", 2)), "modePaiement", mode));
        JsonNode devis = succes(200, appel("POST", "/commandes/devis", panier, v.token()));
        panier.put("devisEmpreinte", devis.get("empreinte").asText()); panier.put("cleIdempotence", UUID.randomUUID().toString());
        return succes(201, appel("POST", "/commandes", panier, v.token()));
    }
    void prete(long id) throws Exception {
        succes(200, appel("PUT", "/partenaire/commandes/" + id + "/accepter", Map.of("tempsPreparationMinutes", 10), partenaire));
        succes(200, appel("PUT", "/partenaire/commandes/" + id + "/prete", null, partenaire));
    }
    void activer() throws Exception {
        succes(200, appel("PUT", "/admin/quartier/commerces/" + partenaireId, Map.of("groupesQuartierActifs", true), admin));
    }

    @Test void troisVoisinsUnGroupeUnLotUnCoursierTroisRemises() throws Exception {
        activer(); Voisin a = new Voisin(client, adresseId), b = voisin(1), c = voisin(2);
        Coursier coursier = coursierDisponible("Coursier quartier");
        long idA = passer(a).get("id").asLong(); prete(idA);
        assertEquals(0, succes(200, appel("GET", "/livreur/offres", null, coursier.token())).size(), "groupe encore ouvert");
        JsonNode proches = succes(200, appel("GET", "/quartier/groupes-proches?adresseId=" + b.adresse(), null, b.token()));
        assertEquals(1, proches.size()); assertEquals(.4, proches.get(0).get("reduction").asDouble(), 1e-9);
        assertFalse(proches.toString().contains("latitude")); assertFalse(proches.toString().contains("Adresse privée"));
        long groupeId = proches.get(0).get("id").asLong();
        long idB = passer(b).get("id").asLong(); prete(idB);
        JsonNode troisieme = passer(c); long idC = troisieme.get("id").asLong();
        assertEquals(0, troisieme.get("fraisLivraison").asDouble());
        assertEquals(groupeId, troisieme.get("groupeQuartierId").asLong());
        assertEquals(0, succes(200, appel("GET", "/livreur/offres", null, coursier.token())).size(), "attend le troisième colis prêt");
        prete(idC);
        JsonNode offre = succes(200, appel("GET", "/livreur/offres", null, coursier.token())).get(0);
        assertEquals(3, offre.get("nbCommandes").asInt()); assertEquals(39, offre.get("montantACollecter").asDouble(), 1e-9);
        JsonNode lot = succes(200, appel("PUT", "/livreur/offres/" + offre.get("id").asLong() + "/accepter", null, coursier.token()));
        assertEquals("QUARTIER", lot.get("source").asText()); assertEquals(3, lot.get("commandes").size());
        for (long id : List.of(idA, idB, idC)) {
            String etiquette = succes(200, appel("GET", "/partenaire/commandes/" + id + "/etiquette", null, partenaire)).get("contenuQr").asText();
            succes(200, appel("POST", "/livreur/missions/" + id + "/collecte", Map.of("code", etiquette), coursier.token()));
        }
        for (var entree : Map.of(idA, a, idB, b, idC, c).entrySet()) {
            long id = entree.getKey(); String token = entree.getValue().token();
            String qr = succes(200, appel("GET", "/commandes/" + id + "/qr-remise", null, token)).get("contenuQr").asText();
            double montant = id == idC ? 12 : 13.5;
            assertEquals("LIVREE", succes(200, appel("POST", "/livreur/missions/" + id + "/remise",
                    Map.of("montantEncaisse", montant, "preuve", qr), coursier.token())).get("statut").asText());
        }
        var g = groupes.findById(groupeId).orElseThrow(); assertNotNull(g.getLot()); assertTrue(g.getGainKm() > 0); assertTrue(g.getGainDt().signum() > 0);
        JsonNode stats = succes(200, appel("GET", "/admin/quartier/statistiques", null, admin)); assertTrue(stats.get("fermes").asInt() >= 1);
        assertEquals(403, appel("GET", "/admin/quartier/groupes", null, client).status());
        assertEquals(403, appel("GET", "/quartier/groupes-proches?adresseId=" + b.adresse(), null, client).status());
    }

    @Test void expirationSingletonEtPreferencePrivee() throws Exception {
        activer(); Voisin a = new Voisin(client, adresseId); long id = passer(a).get("id").asLong(); prete(id);
        Livraison commande = commandes.findById(id).orElseThrow(); long groupeId = commande.getGroupeQuartier().getId();
        GroupeQuartier g = groupes.findById(groupeId).orElseThrow(); g.setExpiration(Instant.now().minusSeconds(1)); groupes.save(g);
        Coursier coursier = coursierDisponible("Singleton");
        JsonNode offre = succes(200, appel("GET", "/livreur/offres", null, coursier.token())).get(0);
        assertEquals(1, offre.get("nbCommandes").asInt()); assertEquals(15, offre.get("montantACollecter").asDouble());
        assertTrue(succes(200, appel("GET", "/quartier/preference", null, client)).get("recevoirInvitationsQuartier").asBoolean());
        assertFalse(succes(200, appel("PUT", "/quartier/preference", Map.of("recevoirInvitationsQuartier", false), client)).get("recevoirInvitationsQuartier").asBoolean());
    }

    @Test void cartesAutoriseesPuisCaptureesAuPrixFinalSansEncaissementCod() throws Exception {
        when(carte.active()).thenReturn(true);
        Map<String, BigDecimal> autorisations = new java.util.concurrent.ConcurrentHashMap<>();
        when(carte.ouvrir(anyLong(), any())).thenAnswer(a -> {
            String session = "cs_" + a.getArgument(0); autorisations.put(session, a.getArgument(1));
            return new PasserelleCarteQuartier.Session(session, "https://checkout.stripe.com/test");
        });
        when(carte.verifier(anyString())).thenAnswer(a -> new PasserelleCarteQuartier.Autorisation("pi_" + a.getArgument(0),
                "requires_capture", autorisations.get(a.getArgument(0)), "tnd"));
        activer(); Voisin a = new Voisin(client, adresseId), b = voisin(1), c = voisin(2);
        Coursier livreur = coursierDisponible("Cartes quartier");
        long idA = passer(a, "CARTE").get("id").asLong();
        assertEquals("EN_ATTENTE", succes(200, appel("POST", "/commandes/" + idA + "/carte/confirmer", null, a.token())).get("statutPaiement").asText());
        verify(carte, never()).capturer(any(), any(), any());
        long idB = passer(b, "CARTE").get("id").asLong(), idC = passer(c, "CARTE").get("id").asLong();
        verify(carte).capturer("pi_cs_" + idA, new BigDecimal("13.500"), idA);
        verify(carte).capturer("pi_cs_" + idB, new BigDecimal("13.500"), idB);
        verify(carte).capturer("pi_cs_" + idC, new BigDecimal("12.000"), idC);
        for (long id : List.of(idA, idB, idC)) prete(id);
        JsonNode offre = succes(200, appel("GET", "/livreur/offres", null, livreur.token())).get(0);
        assertEquals(0, offre.get("montantACollecter").asDouble());
        succes(200, appel("PUT", "/livreur/offres/" + offre.get("id").asLong() + "/accepter", null, livreur.token()));
        for (var entree : Map.of(idA, a, idB, b, idC, c).entrySet()) {
            long id = entree.getKey();
            String etiquette = succes(200, appel("GET", "/partenaire/commandes/" + id + "/etiquette", null, partenaire)).get("contenuQr").asText();
            succes(200, appel("POST", "/livreur/missions/" + id + "/collecte", Map.of("code", etiquette), livreur.token()));
            String qr = succes(200, appel("GET", "/commandes/" + id + "/qr-remise", null, entree.getValue().token())).get("contenuQr").asText();
            assertEquals("LIVREE", succes(200, appel("POST", "/livreur/missions/" + id + "/remise", Map.of("montantEncaisse", 0, "preuve", qr), livreur.token())).get("statut").asText());
        }
    }

    @Test void parametresAdminValidesSontPersistesEtLesInvalidesRefuses() throws Exception {
        JsonNode initiaux = succes(200, appel("GET", "/admin/quartier/parametres", null, admin));
        Map<String, Object> valeurs = new HashMap<>(Map.of("rayonMetres", 500, "fenetreSecondes", 90, "preparationMinutes", 15,
                "promesseMinutes", 60, "reductionDeux", .4, "reductionTrois", .5, "coutKm", .5));
        try {
            assertEquals(90, succes(200, appel("PUT", "/admin/quartier/parametres", valeurs, admin)).get("fenetreSecondes").asInt());
            assertTrue(configurations.findById(1L).orElseThrow().getValeur().contains("90"));
            valeurs.put("rayonMetres", -1); assertEquals(400, appel("PUT", "/admin/quartier/parametres", valeurs, admin).status());
            assertEquals(403, appel("GET", "/admin/quartier/parametres", null, client).status());
        } finally { succes(200, appel("PUT", "/admin/quartier/parametres", initiaux, admin)); }
    }
}
