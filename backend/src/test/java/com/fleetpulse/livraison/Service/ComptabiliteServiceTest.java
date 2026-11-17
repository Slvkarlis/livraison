package com.fleetpulse.livraison.Service;

import static com.fleetpulse.livraison.support.DonneesTest.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.*;
import com.fleetpulse.livraison.Repository.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

/** US-501 / US-503 : comptabilisation a la livraison, ecritures immuables et idempotence. */
@ExtendWith(MockitoExtension.class)
class ComptabiliteServiceTest {
    @Mock FinanceCommandeRepository finances; @Mock EcritureLedgerRepository ledger; @Mock LivraisonRepository commandes;
    @Mock CommissionService commissions; @Mock BaremeService baremes;
    @InjectMocks ComptabiliteService service;

    Livraison livree() {
        Livraison c = commande(StatutLivraison.LIVREE);   // 8 DT d'articles + 3,5 DT de frais = 11,5 DT
        c.setMontantEncaisse(new BigDecimal("11.500")); c.setEcartEncaissement(BigDecimal.ZERO); c.setLivreeLe(Instant.now());
        return c;
    }

    Map<TypeEcriture, BigDecimal> ecritures() {
        ArgumentCaptor<EcritureLedger> e = ArgumentCaptor.forClass(EcritureLedger.class);
        verify(ledger, atLeastOnce()).save(e.capture());
        Map<TypeEcriture, BigDecimal> parType = new EnumMap<>(TypeEcriture.class);
        e.getAllValues().forEach(x -> parType.put(x.getType(), x.getMontant()));
        return parType;
    }

    @Test void livraisonComptabiliseeAvecCommissionNetCashEtRemuneration() {
        Livraison c = livree();
        when(commissions.tauxApplicable(c.getPartenaire())).thenReturn(new BigDecimal("12.00"));
        when(baremes.remuneration(eq(2L), anyDouble())).thenReturn(new BigDecimal("3.926"));

        FinanceCommande f = service.comptabiliser(c);

        assertEquals(new BigDecimal("0.960"), f.getCommission());
        assertEquals(new BigDecimal("7.040"), f.getNetPartenaire());
        assertEquals(new BigDecimal("3.500"), f.getFraisLivraison());
        assertEquals(new BigDecimal("11.500"), f.getMontantEncaisse());
        assertEquals(1.852, f.getDistanceKm(), 1e-9);
        verify(finances).save(f);
        assertEquals(Map.of(TypeEcriture.GMV, new BigDecimal("8.000"), TypeEcriture.COMMISSION, new BigDecimal("0.960"),
                TypeEcriture.NET_PARTENAIRE, new BigDecimal("7.040"), TypeEcriture.FRAIS_LIVRAISON, new BigDecimal("3.500"),
                TypeEcriture.CASH_COURSIER, new BigDecimal("11.500"), TypeEcriture.REMUNERATION_COURSIER, new BigDecimal("3.926")), ecritures());
    }

    @Test void ecartEncaissementTraceEtRejeuSansNouvelleEcriture() {
        Livraison c = livree();
        c.setMontantEncaisse(new BigDecimal("11.000")); c.setEcartEncaissement(new BigDecimal("-0.500")); c.setMotifEcart("Pas de monnaie");
        when(commissions.tauxApplicable(any())).thenReturn(new BigDecimal("12.00"));
        when(baremes.remuneration(any(), anyDouble())).thenReturn(new BigDecimal("3.000"));
        service.comptabiliser(c);
        assertEquals(new BigDecimal("0.500"), ecritures().get(TypeEcriture.ECART_ENCAISSEMENT));

        clearInvocations(ledger, finances);
        when(finances.findByCommandeId(8L)).thenReturn(Optional.of(new FinanceCommande()));
        service.comptabiliser(c);
        verify(ledger, never()).save(any());
        verify(finances, never()).save(any());
    }

    @Test void ecouteurNeReagitQuAuPassageALivree() {
        Livraison c = livree();
        when(commandes.findById(8L)).thenReturn(Optional.of(c));
        when(commissions.tauxApplicable(any())).thenReturn(new BigDecimal("12.00"));
        when(baremes.remuneration(any(), anyDouble())).thenReturn(new BigDecimal("3.000"));
        service.surChangementDeStatut(new CommandeStatutChange(8L, 3L, null, 1L, "c", "l", StatutLivraison.RECUPEREE, StatutLivraison.RECUPEREE, Role.LIVREUR));
        service.surChangementDeStatut(new CommandeStatutChange(8L, 3L, null, 1L, "c", "l", StatutLivraison.AFFECTEE, StatutLivraison.RECUPEREE, Role.LIVREUR));
        verifyNoInteractions(finances);
        service.surChangementDeStatut(new CommandeStatutChange(8L, 3L, null, 1L, "c", "l", StatutLivraison.A_PROXIMITE, StatutLivraison.LIVREE, Role.LIVREUR));
        verify(finances).save(any());
    }

    @Test void commandeSansLivreurNiArticlesDetailles() {
        Livraison c = livree(); c.setLivreur(null); c.setMontantArticles(null);
        when(commissions.tauxApplicable(any())).thenReturn(new BigDecimal("10.00"));
        FinanceCommande f = service.comptabiliser(c);
        assertEquals(new BigDecimal("8.000"), f.getMontantArticles(), "total - frais");
        assertEquals(new BigDecimal("0.000"), f.getRemunerationCoursier());
        assertFalse(ecritures().containsKey(TypeEcriture.CASH_COURSIER));
        verifyNoInteractions(baremes);
    }

    @Test void detailInconnu() {
        when(finances.findByCommandeId(99L)).thenReturn(Optional.empty());
        assertEquals(404, assertThrows(MarketplaceException.class, () -> service.detail(99L)).getStatut());
    }
}
