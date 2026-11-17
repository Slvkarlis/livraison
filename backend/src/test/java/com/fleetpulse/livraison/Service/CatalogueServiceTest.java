package com.fleetpulse.livraison.Service;

import static com.fleetpulse.livraison.support.DonneesTest.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.fleetpulse.livraison.Dto.MarketplaceDto.*;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.StatutCompte;
import com.fleetpulse.livraison.Repository.*;
import java.math.BigDecimal;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

@ExtendWith(MockitoExtension.class)
class CatalogueServiceTest {
    @Mock PartenaireRepository partenaires; @Mock ProduitRepository produits;
    @Mock AdresseLivraisonRepository adresses; @Mock ZoneService zones;
    @InjectMocks CatalogueService service;
    final String email = "partenaire@test.tn";
    Partenaire titulaire() {
        Partenaire p = partenaire(); when(partenaires.verrouillerEmail(email)).thenReturn(Optional.of(p)); return p;
    }
    @Test void commerceOuvertureEtFermeture() {
        Partenaire p = titulaire(); assertEquals("Chez Amira", service.moi(email).nomCommerce());
        assertFalse(service.ouverture(email, new CommerceRequest(false)).ouvert());
        assertTrue(service.ouverture(email, new CommerceRequest(true)).ouvert());
        p.setZone(null); assertThrows(MarketplaceException.class, () -> service.ouverture(email, new CommerceRequest(true)));
        assertThrows(IllegalArgumentException.class, () -> service.ouverture(email, null));
    }
    @Test void partenaireAbsentOuSuspendu() {
        assertThrows(MarketplaceException.class, () -> service.moi(email));
        titulaire().setStatut(StatutCompte.SUSPENDU); assertThrows(AccessDeniedException.class, () -> service.moi(email));
    }
    @Test void creerModifierEtListerProduits() {
        titulaire(); when(produits.save(any())).thenAnswer(i -> { Produit p = i.getArgument(0); p.setId(6L); return p; });
        var r = new ProduitRequest(" Couscous ", new BigDecimal("8"), true);
        assertEquals(new BigDecimal("8.000"), service.enregistrer(email, null, r).prix());
        Produit p = produit(); when(produits.findById(6L)).thenReturn(Optional.of(p));
        assertFalse(service.enregistrer(email, 6L, new ProduitRequest("Plat", new BigDecimal("9"), false)).disponible());
        when(produits.findAllByPartenaireIdOrderByIdAsc(3L)).thenReturn(List.of(p));
        assertEquals("Plat", service.mesProduits(email).getFirst().nom()); verify(produits).save(p);
    }
    @Test void produitInvalideIntrouvableOuAutreCatalogue() {
        titulaire(); assertThrows(IllegalArgumentException.class, () -> service.enregistrer(email, null, null));
        assertThrows(IllegalArgumentException.class, () -> service.enregistrer(email, null, new ProduitRequest("Plat", BigDecimal.ZERO, true)));
        assertThrows(MarketplaceException.class, () -> service.enregistrer(email, 99L, new ProduitRequest("Plat", BigDecimal.ONE, true)));
        Produit p = produit(); p.getPartenaire().setId(99L); when(produits.findById(6L)).thenReturn(Optional.of(p));
        assertThrows(AccessDeniedException.class, () -> service.enregistrer(email, 6L, new ProduitRequest("Plat", BigDecimal.ONE, true)));
        verify(produits, never()).save(any());
    }
    @Test void rechercheFiltreZoneOuvertureCategorieEtNom() {
        when(adresses.findById(7L)).thenReturn(Optional.of(adresse())); when(zones.desservie(36.81, 10.19)).thenReturn(zone());
        Partenaire ouvert = partenaire(), ferme = partenaire(), horsZone = partenaire();
        ferme.setOuvert(false); horsZone.getZone().setId(99L);
        when(partenaires.findAll()).thenReturn(List.of(ouvert, ferme, horsZone));
        assertEquals(1, service.rechercher("client@test.tn", 7L, "restaurant", " AMIRA ").size());
        assertTrue(service.rechercher("client@test.tn", 7L, "Épicerie", null).isEmpty());
        when(produits.findAllByPartenaireIdOrderByIdAsc(3L)).thenReturn(List.of(produit()));
        assertEquals(1, service.catalogue("client@test.tn", 3L, 7L).size());
        assertThrows(MarketplaceException.class, () -> service.catalogue("client@test.tn", 99L, 7L));
    }
    @Test void adresseAbsenteEtAutreClient() {
        assertThrows(IllegalArgumentException.class, () -> service.adresse("client@test.tn", null));
        assertThrows(MarketplaceException.class, () -> service.adresse("client@test.tn", 99L));
        when(adresses.findById(7L)).thenReturn(Optional.of(adresse()));
        assertThrows(AccessDeniedException.class, () -> service.adresse("autre@test.tn", 7L));
    }
}
