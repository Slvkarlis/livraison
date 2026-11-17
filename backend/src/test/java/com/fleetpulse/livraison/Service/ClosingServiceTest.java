package com.fleetpulse.livraison.Service;

import static com.fleetpulse.livraison.support.DonneesTest.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.fleetpulse.livraison.Dto.FinanceDto.*;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.*;
import com.fleetpulse.livraison.Repository.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

/** US-506 / US-512 : closing hebdomadaire, reversements (cash rapproche uniquement) et remunerations. */
@ExtendWith(MockitoExtension.class)
class ClosingServiceTest {
    @Mock FinanceCommandeRepository finances; @Mock ClosingRepository closings; @Mock ReleveReversementRepository relevesPartenaires;
    @Mock ReleveCoursierRepository relevesCoursiers; @Mock ComptabiliteService comptabilite; @Mock AuditService audit;
    @InjectMocks ClosingService service;
    final LocalDate semaineDerniere = LocalDate.now(MessagesStatut.FUSEAU).minusWeeks(1);

    FinanceCommande livree(long id, boolean deposee) {
        Livraison c = commande(StatutLivraison.LIVREE); c.setId(id); c.setCodeSuivi("FP-" + id);
        FinanceCommande f = new FinanceCommande(); f.setCommande(c); f.setPartenaire(c.getPartenaire()); f.setLivreur(c.getLivreur());
        f.setMontantArticles(new BigDecimal("8.000")); f.setCommission(new BigDecimal("0.960")); f.setNetPartenaire(new BigDecimal("7.040"));
        f.setMontantEncaisse(new BigDecimal("11.500")); f.setRemunerationCoursier(new BigDecimal("3.926")); f.setDistanceKm(1.852);
        f.setLivreeLe(Instant.now().minusSeconds(8 * 86400));
        if (deposee) f.setDepot(new DepotCash());
        return f;
    }

    void commandes(List<FinanceCommande> deposees, List<FinanceCommande> toutes) {
        when(finances.findAllByDepotIsNotNullAndClosingPartenaireIsNullAndLivreeLeBeforeOrderByIdAsc(any())).thenReturn(deposees);
        when(finances.findAllByClosingCoursierIsNullAndLivreurIsNotNullAndLivreeLeBeforeOrderByIdAsc(any())).thenReturn(toutes);
        when(finances.findAllByDepotIsNullAndLivreurIsNotNullOrderByLivreeLeAscIdAsc())
                .thenReturn(toutes.stream().filter(f -> f.getDepot() == null).toList());
    }

    @Test void apercuNeReverseQueLeCashRapproche() {
        FinanceCommande deposee = livree(1, true), enMain = livree(2, false);
        commandes(List.of(deposee), List.of(deposee, enMain));
        ClosingVue vue = service.apercu(semaineDerniere);
        assertNull(vue.id());
        assertEquals(1, vue.partenaires().size());
        assertEquals(new BigDecimal("7.040"), vue.totalReversements());
        assertEquals(new BigDecimal("7.852"), vue.totalRemunerations(), "les deux missions sont payees au livreur");
        assertEquals(1, vue.commandesNonRapprochees());
        assertEquals(new BigDecimal("11.500"), vue.cashNonRapproche());
        assertEquals(3.704, vue.coursiers().getFirst().distanceKm(), 1e-9);
        verifyNoInteractions(comptabilite, audit);   // un apercu n'ecrit rien
    }

    @Test void validationEnregistreReleveMarqueLesCommandesEtEcritAuLedger() {
        FinanceCommande deposee = livree(1, true), enMain = livree(2, false);
        commandes(List.of(deposee), List.of(deposee, enMain));
        when(closings.save(any())).thenAnswer(i -> { Closing c = i.getArgument(0); c.setId(7L); return c; });

        service.valider("finance@test.tn", new ClosingRequest(semaineDerniere));

        assertNotNull(deposee.getClosingPartenaire());
        assertNull(enMain.getClosingPartenaire(), "cash pas encore depose : reverse au prochain closing");
        assertNotNull(enMain.getClosingCoursier());
        verify(relevesPartenaires).save(argThat(r -> r.getNet().equals(new BigDecimal("7.040")) && r.getNbCommandes() == 1));
        verify(relevesCoursiers).save(argThat(r -> r.getNbMissions() == 2 && r.getRemuneration().equals(new BigDecimal("7.852"))));
        verify(comptabilite).ecrire(eq(TypeEcriture.REVERSEMENT_PARTENAIRE), eq(new BigDecimal("7.040")), eq(1L), eq(3L), isNull(), isNull(),
                eq(7L), anyString(), any());
        verify(comptabilite, times(2)).ecrire(eq(TypeEcriture.PAIEMENT_COURSIER), any(), any(), isNull(), eq(4L), isNull(), eq(7L), anyString(), any());
        verify(audit).enregistrer(eq(ActionAudit.CLOSING_VALIDE), eq("CLOSING"), eq(7L), contains("7.040 DT"));
    }

    @Test void semaineEnCoursOuDejaCloturee() {
        assertEquals(409, assertThrows(MarketplaceException.class,
                () -> service.valider("f", new ClosingRequest(LocalDate.now(MessagesStatut.FUSEAU)))).getStatut());
        when(closings.findBySemaine(CalculsFinanciers.semaine(semaineDerniere).lundi())).thenReturn(Optional.of(new Closing()));
        assertEquals(409, assertThrows(MarketplaceException.class, () -> service.valider("f", new ClosingRequest(semaineDerniere))).getStatut());
        assertThrows(IllegalArgumentException.class, () -> service.valider("f", null));
        verify(closings, never()).save(any());
        verifyNoInteractions(comptabilite, audit);
    }
}
