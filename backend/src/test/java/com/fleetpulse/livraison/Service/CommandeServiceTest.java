package com.fleetpulse.livraison.Service;

import static com.fleetpulse.livraison.support.DonneesTest.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.fleetpulse.livraison.Dto.MarketplaceDto.*;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.*;
import com.fleetpulse.livraison.Repository.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class CommandeServiceTest {
    @Mock ClientRepository clients; @Mock PartenaireRepository partenaires; @Mock ProduitRepository produits;
    @Mock LivraisonRepository commandes; @Mock CatalogueService catalogue; @Mock ZoneService zones;
    @Mock CommandeWorkflow workflow; @Mock HistoriqueStatutRepository historique; @InjectMocks CommandeService service;
    final String email = "client@test.tn";
    @BeforeEach void configurer() {
        ReflectionTestUtils.setField(service, "minimum", BigDecimal.ONE); ReflectionTestUtils.setField(service, "maximum", new BigDecimal("1000"));
        ReflectionTestUtils.setField(service, "activesMax", 3); ReflectionTestUtils.setField(service, "intervalle", 30);
    }
    PanierRequest panier(String cle, String empreinte) { return new PanierRequest(3L, 7L, List.of(new Article(6L, 2)), "Sans sauce", cle, empreinte); }
    void contexteDevis() {
        when(clients.verrouiller(email)).thenReturn(Optional.of(client()));
        when(catalogue.adresse(email, 7L)).thenReturn(adresse()); when(zones.desservie(36.81, 10.19)).thenReturn(zone());
        when(partenaires.verrouiller(3L)).thenReturn(Optional.of(partenaire())); when(produits.findById(6L)).thenReturn(Optional.of(produit()));
    }
    @Test void devisCalculeArticlesFraisEtEmpreinteStable() {
        contexteDevis(); var a = service.devis(email, panier(null, null)); var b = service.devis(email, panier(null, null));
        assertEquals(new BigDecimal("16.000"), a.montantArticles()); assertEquals(new BigDecimal("19.500"), a.total());
        assertEquals(64, a.empreinte().length()); assertEquals(a.empreinte(), b.empreinte());
    }
    @Test void commandeFigeLePrixEtEcritHistorique() {
        contexteDevis(); var devis = service.devis(email, panier(null, null));
        when(partenaires.getReferenceById(3L)).thenReturn(partenaire()); when(produits.getReferenceById(6L)).thenReturn(produit());
        when(commandes.saveAndFlush(any())).thenAnswer(i -> { Livraison c = i.getArgument(0); c.setId(8L); return c; });
        var vue = service.commander(email, panier("cle-idempotence-00001", devis.empreinte()));
        assertEquals(StatutLivraison.PENDING_PARTNER, vue.statut()); assertEquals(19.5, vue.montantTotal());
        assertEquals("Couscous", vue.lignes().getFirst().nomProduit());
        verify(workflow).creer(argThat(c -> c.getCleIdempotence().startsWith("1:")), any(Client.class));
    }
    @Test void refusePanierVideOuQuantitesInvalidesAvantLaBase() {
        assertThrows(IllegalArgumentException.class, () -> service.devis(email, null));
        assertThrows(IllegalArgumentException.class, () -> service.devis(email, new PanierRequest(3L, 7L, List.of(), null, null, null)));
        assertThrows(IllegalArgumentException.class, () -> service.devis(email, new PanierRequest(3L, 7L, List.of(new Article(6L, 0)), null, null, null)));
        assertThrows(IllegalArgumentException.class, () -> service.commander(email, panier(null, null))); verifyNoInteractions(clients);
    }
    @Test void limiteDesCommandesActivesEtFrequence() {
        when(clients.verrouiller(email)).thenReturn(Optional.of(client()));
        when(commandes.countByClientIdAndStatutIn(eq(1L), any())).thenReturn(3L);
        var r = panier("cle-idempotence-00001", "a".repeat(64));
        assertThrows(MarketplaceException.class, () -> service.commander(email, r));
        when(commandes.countByClientIdAndStatutIn(eq(1L), any())).thenReturn(0L);
        Livraison recente = commande(StatutLivraison.PENDING_PARTNER); recente.setDateCreation(Instant.now());
        when(commandes.findFirstByClientIdOrderByDateCreationDesc(1L)).thenReturn(Optional.of(recente));
        assertEquals(429, assertThrows(MarketplaceException.class, () -> service.commander(email, r)).getStatut());
        verify(commandes, never()).saveAndFlush(any());
    }
    @Test void nouveauDevisExigeSiLePrixAChange() {
        contexteDevis(); assertThrows(MarketplaceException.class, () -> service.commander(email, panier("cle-idempotence-00001", "a".repeat(64))));
        verify(commandes, never()).saveAndFlush(any());
    }
    @Test void historiqueEtAnnulationProtegesParLeProprietaire() {
        Livraison c = commande(StatutLivraison.PENDING_PARTNER); when(commandes.findById(8L)).thenReturn(Optional.of(c));
        assertTrue(service.historique(email, 8L).isEmpty());
        assertThrows(MarketplaceException.class, () -> service.historique("autre@test.tn", 8L));
        when(clients.verrouiller(email)).thenReturn(Optional.of(client())); when(commandes.verrouiller(8L)).thenReturn(Optional.of(c));
        service.annuler(email, 8L, new AnnulationRequest(" Test terminé ")); assertEquals("Test terminé", c.getMotifAnnulation());
        verify(workflow).transition(eq(c), eq(StatutLivraison.ANNULEE), any(), contains("Test terminé"));
        c.setStatut(StatutLivraison.EN_PREPARATION); assertThrows(MarketplaceException.class, () -> service.annuler(email, 8L, null));
    }
}
