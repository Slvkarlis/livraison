package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.*;
import java.math.BigDecimal;
import org.junit.jupiter.api.*;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class PaiementQuartierServiceTest {
    final PaiementQuartierService service = new PaiementQuartierService();
    final PasserelleCarteQuartier carte = mock(PasserelleCarteQuartier.class);
    final Livraison c = new Livraison(); final GroupeQuartier g = new GroupeQuartier();
    @BeforeEach void preparer() {
        ReflectionTestUtils.setField(service, "carte", carte);
        c.setId(1L); c.setSessionCarte("cs_test"); c.setModePaiement(ModePaiement.CARTE); c.setStatutPaiement(StatutPaiement.EN_ATTENTE);
        c.setGroupeQuartier(g); c.setMontantAutoriseCarte(new BigDecimal("15.000")); c.setTotal(new BigDecimal("13.500")); c.setFraisFinauxQuartier(new BigDecimal("1.500"));
        when(carte.verifier("cs_test")).thenReturn(new PasserelleCarteQuartier.Autorisation("pi_test", "requires_capture", new BigDecimal("15.000"), "tnd"));
    }
    @Test void autorisationSeuleNeDeclencheAucunDebitNiDepart() {
        service.actualiser(c); verify(carte, never()).capturer(any(), any(), any()); assertFalse(DispatchService.paiementValide(c));
    }
    @Test void fermetureCaptureLePrixReduitPuisPermetLeDepart() {
        g.setStatut(StatutGroupeQuartier.FERME); service.actualiser(c);
        verify(carte).capturer("pi_test", new BigDecimal("13.500"), 1L); assertEquals(StatutPaiement.PAYE, c.getStatutPaiement());
        assertTrue(DispatchService.paiementValide(c)); assertEquals(0, RemiseLivreurService.montantAttendu(c).signum());
        service.actualiser(c); verify(carte, times(1)).capturer(any(), any(), any());
    }
    @Test void montantOuDeviseDiscordantsRefuses() {
        when(carte.verifier("cs_test")).thenReturn(new PasserelleCarteQuartier.Autorisation("pi_test", "requires_capture", new BigDecimal("15.000"), "eur"));
        assertThrows(MarketplaceException.class, () -> service.actualiser(c)); verify(carte, never()).capturer(any(), any(), any());
    }
    @Test void annulationLibereOuRembourseSansDoubleAppel() {
        c.setStatut(StatutLivraison.ANNULEE); service.actualiser(c); service.actualiser(c);
        verify(carte, times(1)).annuler("cs_test", 1L); assertTrue(c.isCarteAnnulee());
    }
    @Test void precisionStripeEtArrondiToujoursFavorableAuClient() {
        assertEquals(13500, StripeCarteQuartier.millimes(new BigDecimal("13.500")));
        assertThrows(MarketplaceException.class, () -> StripeCarteQuartier.millimes(new BigDecimal("13.505")));
        g.setStatut(StatutGroupeQuartier.FERME); c.setTotal(new BigDecimal("13.875")); c.setFraisFinauxQuartier(new BigDecimal("1.875")); service.actualiser(c);
        assertEquals(new BigDecimal("13.870"), c.getTotal()); verify(carte).capturer("pi_test", new BigDecimal("13.870"), 1L);
    }
    @Test void reprendApresCaptureReussieMaisTransactionLocaleInterrompue() {
        g.setStatut(StatutGroupeQuartier.FERME);
        when(carte.verifier("cs_test")).thenReturn(new PasserelleCarteQuartier.Autorisation("pi_test", "succeeded", new BigDecimal("15.000"), "tnd", new BigDecimal("13.500")));
        service.actualiser(c); assertEquals(StatutPaiement.PAYE, c.getStatutPaiement()); verify(carte, never()).capturer(any(), any(), any());
    }
}
