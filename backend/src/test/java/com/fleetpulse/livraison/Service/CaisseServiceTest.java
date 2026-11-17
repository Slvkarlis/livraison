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
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

/** US-504 / US-505 : soldes des coursiers et depot integral avec recu. */
@ExtendWith(MockitoExtension.class)
class CaisseServiceTest {
    @Mock FinanceCommandeRepository finances; @Mock DepotCashRepository depots; @Mock LivreurRepository livreurs;
    @Mock ReleveCoursierRepository releves; @Mock ComptabiliteService comptabilite; @Mock AuditService audit;
    @InjectMocks CaisseService service;
    final String cle = "depot-0001-abcd";

    FinanceCommande encaissee(long id, String montant) {
        Livraison c = commande(StatutLivraison.LIVREE); c.setId(id); c.setCodeSuivi("FP-" + id);
        FinanceCommande f = new FinanceCommande(); f.setCommande(c); f.setLivreur(c.getLivreur()); f.setPartenaire(c.getPartenaire());
        f.setMontantEncaisse(new BigDecimal(montant)); f.setEcartEncaissement(BigDecimal.ZERO.setScale(3));
        f.setRemunerationCoursier(new BigDecimal("3.000")); f.setLivreeLe(Instant.now()); return f;
    }

    void soldeDeSami(FinanceCommande... commandes) {
        when(livreurs.verrouiller(4L)).thenReturn(Optional.of(livreur()));
        when(finances.findAllByLivreurIdAndDepotIsNullOrderByLivreeLeAscIdAsc(4L)).thenReturn(List.of(commandes));
        when(depots.save(any())).thenAnswer(i -> { DepotCash d = i.getArgument(0); d.setId(42L); return d; });
    }

    @Test void cashEnCirculationParCoursier() {
        when(finances.findAllByDepotIsNullAndLivreurIsNotNullOrderByLivreeLeAscIdAsc()).thenReturn(List.of(encaissee(1, "11.500"), encaissee(2, "15.000")));
        CaissesVue vue = service.caisses();
        assertEquals(new BigDecimal("26.500"), vue.cashEnCirculation());
        assertEquals(1, vue.coursiers().size());
        assertEquals(2, vue.coursiers().getFirst().nbCommandes());
    }

    @Test void depotExactRapprocheToutesLesCommandes() {
        FinanceCommande a = encaissee(1, "11.500"), b = encaissee(2, "15.000");
        soldeDeSami(a, b);
        RecuVue recu = service.deposer("finance@test.tn", new DepotRequest(4L, new BigDecimal("26.5"), null, cle));
        assertEquals(StatutDepot.RAPPROCHE, recu.statut());
        assertEquals(new BigDecimal("26.500"), recu.montantAttendu());
        assertTrue(recu.numeroRecu().matches("RC-\\d{4}-000042"));
        assertNotNull(a.getDepot()); assertSame(a.getDepot(), b.getDepot());
        verify(comptabilite, times(2)).ecrire(eq(TypeEcriture.DEPOT_CASH), any(), any(), any(), eq(4L), eq(42L), isNull(), anyString(), any());
        verify(comptabilite, never()).ecrire(eq(TypeEcriture.ECART_DEPOT), any(), any(), any(), any(), any(), any(), anyString(), any());
        verify(audit).enregistrer(eq(ActionAudit.DEPOT_CASH_ENREGISTRE), eq("LIVREUR"), eq(4L), contains("26.500 DT"));
    }

    @Test void ecartAvecMotifObligatoire() {
        soldeDeSami(encaissee(1, "11.500"));
        DepotRequest sansMotif = new DepotRequest(4L, new BigDecimal("11"), null, cle);
        assertThrows(IllegalArgumentException.class, () -> service.deposer("f", sansMotif));
        RecuVue recu = service.deposer("f", new DepotRequest(4L, new BigDecimal("11"), "Billet perdu", cle));
        assertEquals(StatutDepot.ECART, recu.statut());
        assertEquals(new BigDecimal("-0.500"), recu.ecart());
        verify(comptabilite).ecrire(eq(TypeEcriture.ECART_DEPOT), eq(new BigDecimal("0.500")), isNull(), isNull(), eq(4L), eq(42L), isNull(),
                contains("manque"), any());
    }

    @Test void rejeuDeLaMemeCleEtConflits() {
        DepotCash d = new DepotCash(); d.setId(42L); d.setLivreur(livreur()); d.setMontantRecu(new BigDecimal("11.500"));
        d.setMontantAttendu(new BigDecimal("11.500")); d.setEcart(BigDecimal.ZERO); d.setStatut(StatutDepot.RAPPROCHE);
        d.setNumeroRecu("RC-2026-000042"); d.setDate(Instant.now()); d.setEnregistrePar("f");
        when(depots.findByCleIdempotence(cle)).thenReturn(Optional.of(d));
        assertEquals("RC-2026-000042", service.deposer("f", new DepotRequest(4L, new BigDecimal("11.5"), null, cle)).numeroRecu());
        assertEquals(409, assertThrows(MarketplaceException.class,
                () -> service.deposer("f", new DepotRequest(4L, new BigDecimal("12"), null, cle))).getStatut());
        verify(depots, never()).save(any());

        when(livreurs.verrouiller(4L)).thenReturn(Optional.of(livreur()));
        assertEquals(409, assertThrows(MarketplaceException.class,
                () -> service.deposer("f", new DepotRequest(4L, BigDecimal.ONE, null, "autre-cle-123"))).getStatut(), "rien a deposer");
        assertThrows(IllegalArgumentException.class, () -> service.deposer("f", new DepotRequest(4L, BigDecimal.ONE, null, "court")));
        assertThrows(IllegalArgumentException.class, () -> service.deposer("f", new DepotRequest(null, BigDecimal.ONE, null, cle)));
    }

    @Test void caisseDuLivreurConnecte() {
        Livreur sami = livreur();
        when(livreurs.findByEmail(sami.getEmail())).thenReturn(Optional.of(sami));
        when(finances.findAllByLivreurIdAndDepotIsNullOrderByLivreeLeAscIdAsc(4L)).thenReturn(List.of(encaissee(1, "11.500")));
        when(finances.findAllByLivreurIdAndClosingCoursierIsNullOrderByLivreeLeAscIdAsc(4L)).thenReturn(List.of(encaissee(1, "11.500"), encaissee(2, "9")));
        CaisseLivreurVue vue = service.caisseDuLivreur(sami.getEmail());
        assertEquals(new BigDecimal("11.500"), vue.solde());
        assertEquals(2, vue.missionsEnAttente());
        assertEquals(new BigDecimal("6.000"), vue.remunerationEnAttente());
        assertEquals("FP-1", vue.commandes().getFirst().codeSuivi());
    }
}
