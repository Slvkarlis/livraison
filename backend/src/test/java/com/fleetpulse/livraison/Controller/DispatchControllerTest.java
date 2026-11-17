package com.fleetpulse.livraison.Controller;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fleetpulse.livraison.Dto.DispatchDto.*;
import com.fleetpulse.livraison.Service.*;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;

@ExtendWith(MockitoExtension.class)
class DispatchControllerTest extends ControleurTestSupport {
    @Mock DispatchService dispatch; @InjectMocks DispatchController controleur; MockMvc http;
    final SupervisionVue vue = new SupervisionVue(Instant.now(), true, false, 60, 10,
            List.of(new CommandeAttenteVue(8L, "FP-1", "Chez Amira", "Tunis", Instant.now().minusSeconds(900), 15, true, null, null)),
            List.of(), List.of(new LivreurSupervisionVue(4L, "Sami", "Livreur", 0, false, 36.8, 10.18, Instant.now())));
    @BeforeEach void preparer() { http = http(controleur); }

    @Test void supervisionAvecAlerte() throws Exception {
        when(dispatch.supervision()).thenReturn(vue);
        http.perform(get("/api/admin/dispatch")).andExpect(status().isOk())
                .andExpect(jsonPath("$.enAttente[0].alerte").value(true))
                .andExpect(jsonPath("$.livreurs[0].prenom").value("Sami"))
                .andExpect(jsonPath("$.parLots").value(true));
    }

    @Test void forcerAvecMotifEtErreurs() throws Exception {
        when(dispatch.forcer(eq(utilisateur.getName()), eq(8L), any())).thenReturn(vue);
        when(dispatch.forcer(eq(utilisateur.getName()), eq(9L), any())).thenThrow(new IllegalArgumentException("Motif obligatoire"));
        when(dispatch.forcer(eq(utilisateur.getName()), eq(10L), any())).thenThrow(MarketplaceException.conflit("Déjà affectée"));
        http.perform(put("/api/admin/dispatch/commandes/8/forcer").principal(utilisateur).contentType("application/json")
                .content("{\"livreurId\":4,\"motif\":\"Client prioritaire\"}")).andExpect(status().isOk());
        verify(dispatch).forcer(utilisateur.getName(), 8L, new ForcerRequest(4L, "Client prioritaire"));
        http.perform(put("/api/admin/dispatch/commandes/9/forcer").principal(utilisateur).contentType("application/json")
                .content("{\"livreurId\":4}")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("DONNEES_INVALIDES"));
        http.perform(put("/api/admin/dispatch/commandes/10/forcer").principal(utilisateur).contentType("application/json")
                .content("{\"livreurId\":4,\"motif\":\"Client prioritaire\"}")).andExpect(status().isConflict());
    }

    @Test void cycleManuel() throws Exception {
        when(dispatch.cycle()).thenReturn(new CycleVue(1, 2));
        http.perform(post("/api/admin/dispatch/cycle")).andExpect(status().isOk())
                .andExpect(jsonPath("$.offresExpirees").value(1)).andExpect(jsonPath("$.offresProposees").value(2));
    }
}
