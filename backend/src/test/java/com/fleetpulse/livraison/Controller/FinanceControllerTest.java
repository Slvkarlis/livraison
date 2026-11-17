package com.fleetpulse.livraison.Controller;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fleetpulse.livraison.Dto.FinanceDto.*;
import com.fleetpulse.livraison.Model.enums.PorteeCommission;
import com.fleetpulse.livraison.Model.enums.StatutDepot;
import com.fleetpulse.livraison.Model.enums.TypeEcriture;
import com.fleetpulse.livraison.Service.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;

@ExtendWith(MockitoExtension.class)
class FinanceControllerTest extends ControleurTestSupport {
    @Mock CommissionService commissions; @Mock BaremeService baremes; @Mock ComptabiliteService comptabilite;
    @Mock CaisseService caisses; @Mock ClosingService closings;
    @InjectMocks FinanceController controleur; MockMvc http;
    @BeforeEach void preparer() { http = http(controleur); }

    final RecuVue recu = new RecuVue(42L, "RC-2026-000042", 4L, "Sami Livreur", new BigDecimal("11.500"), new BigDecimal("11.500"),
            BigDecimal.ZERO, null, StatutDepot.RAPPROCHE, 1, Instant.now(), "finance@test.tn", List.of());
    final ClosingVue closing = new ClosingVue(7L, LocalDate.parse("2026-11-09"), Instant.now(), Instant.now(), Instant.now(), "finance@test.tn",
            new BigDecimal("7.040"), new BigDecimal("3.926"), 1, 1, 0, BigDecimal.ZERO,
            List.of(new ReleveReversementVue(3L, "Chez Amira", 1, new BigDecimal("8.000"), new BigDecimal("0.960"), new BigDecimal("7.040"))),
            List.of(new ReleveCoursierVue(4L, "Sami", "Livreur", 1, 1.852, new BigDecimal("3.926"))));

    @Test void commissionsEtBaremes() throws Exception {
        when(commissions.lister()).thenReturn(new CommissionsVue(new BigDecimal("12.00"), List.of()));
        http.perform(get("/api/admin/finance/commissions")).andExpect(status().isOk()).andExpect(jsonPath("$.tauxGlobal").value(12.00));
        when(commissions.definir(eq(utilisateur.getName()), any())).thenReturn(new TauxVue(1L, PorteeCommission.CATEGORIE, "epicerie", null, null,
                new BigDecimal("9.50"), Instant.now(), "x"));
        http.perform(put("/api/admin/finance/commissions").principal(utilisateur).contentType("application/json")
                .content("{\"portee\":\"CATEGORIE\",\"categorie\":\"Epicerie\",\"taux\":9.5}")).andExpect(status().isOk())
                .andExpect(jsonPath("$.categorie").value("epicerie"));
        verify(commissions).definir(utilisateur.getName(), new TauxRequest(PorteeCommission.CATEGORIE, "Epicerie", null, new BigDecimal("9.5")));
        http.perform(delete("/api/admin/finance/commissions/1")).andExpect(status().isNoContent());
        verify(commissions).supprimer(1L);
        when(baremes.definir(eq(utilisateur.getName()), eq(2L), any())).thenThrow(new IllegalArgumentException("Base par mission : montant positif"));
        http.perform(put("/api/admin/finance/baremes/2").principal(utilisateur).contentType("application/json").content("{\"base\":-1,\"parKm\":0.5}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("DONNEES_INVALIDES"));
    }

    @Test void ledgerFiltreEtDetailDeCommande() throws Exception {
        when(comptabilite.ecritures(8L, null, null, TypeEcriture.COMMISSION, null, null)).thenReturn(List.of(new EcritureVue(1L,
                TypeEcriture.COMMISSION, new BigDecimal("0.960"), 8L, 3L, null, null, null, "FP-1 : commission 12.00 %", Instant.now())));
        http.perform(get("/api/admin/finance/ledger").param("commandeId", "8").param("type", "COMMISSION"))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].montant").value(0.960));
        when(comptabilite.detail(99L)).thenThrow(MarketplaceException.absent());
        http.perform(get("/api/admin/finance/commandes/99")).andExpect(status().isNotFound());
    }

    @Test void depotCreeUnRecu() throws Exception {
        when(caisses.deposer(eq(utilisateur.getName()), any())).thenReturn(recu);
        http.perform(post("/api/admin/finance/depots").principal(utilisateur).contentType("application/json")
                .content("{\"livreurId\":4,\"montantRecu\":11.5,\"cleIdempotence\":\"depot-0001-abcd\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.numeroRecu").value("RC-2026-000042"));
        verify(caisses).deposer(utilisateur.getName(), new DepotRequest(4L, new BigDecimal("11.5"), null, "depot-0001-abcd"));
        when(caisses.caisses()).thenReturn(new CaissesVue(new BigDecimal("26.500"), List.of()));
        http.perform(get("/api/admin/finance/caisses")).andExpect(jsonPath("$.cashEnCirculation").value(26.5));
    }

    @Test void closingApercuValidationEtConflit() throws Exception {
        when(closings.apercu(LocalDate.parse("2026-11-12"))).thenReturn(closing);
        http.perform(get("/api/admin/finance/closings/apercu").param("semaine", "2026-11-12")).andExpect(status().isOk())
                .andExpect(jsonPath("$.partenaires[0].net").value(7.04));
        when(closings.valider(eq(utilisateur.getName()), any())).thenReturn(closing)
                .thenThrow(MarketplaceException.conflit("Cette semaine est déjà clôturée."));
        http.perform(post("/api/admin/finance/closings").principal(utilisateur).contentType("application/json").content("{\"semaine\":\"2026-11-12\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.id").value(7));
        http.perform(post("/api/admin/finance/closings").principal(utilisateur).contentType("application/json").content("{\"semaine\":\"2026-11-12\"}"))
                .andExpect(status().isConflict());
        verify(closings, times(2)).valider(utilisateur.getName(), new ClosingRequest(LocalDate.parse("2026-11-12")));
    }
}
