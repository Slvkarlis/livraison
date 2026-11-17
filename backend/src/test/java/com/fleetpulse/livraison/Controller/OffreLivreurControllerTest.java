package com.fleetpulse.livraison.Controller;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fleetpulse.livraison.Dto.DispatchDto.*;
import com.fleetpulse.livraison.Model.enums.StatutLot;
import com.fleetpulse.livraison.Service.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;

@ExtendWith(MockitoExtension.class)
class OffreLivreurControllerTest extends ControleurTestSupport {
    @Mock DispatchService dispatch; @InjectMocks OffreLivreurController controleur; MockMvc http;
    final List<EtapeVue> etapes = List.of(new EtapeVue(1, 8L, "FP-1", "COLLECTE", "Chez Amira", 36.8, 10.18, 0),
            new EtapeVue(2, 8L, "FP-1", "LIVRAISON", "Amal — zone Tunis", null, null, 8));
    @BeforeEach void preparer() { http = http(controleur); }

    @Test void offresEnAttenteAvecItineraire() throws Exception {
        when(dispatch.offres(utilisateur.getName())).thenReturn(List.of(new OffreVue(70L, 50L, Instant.now(), Instant.now().plusSeconds(60),
                true, 0.4, 1, 2.1, 12, new BigDecimal("11.500"), etapes)));
        http.perform(get("/api/livreur/offres").principal(utilisateur)).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(70)).andExpect(jsonPath("$[0].horsZone").value(true))
                .andExpect(jsonPath("$[0].etapes[1].type").value("LIVRAISON"))
                .andExpect(jsonPath("$[0].etapes[1].latitude").isEmpty());
    }

    @Test void accepterRefuserEtOffreExpiree() throws Exception {
        when(dispatch.accepter(utilisateur.getName(), 70L)).thenReturn(new LotVue(50L, StatutLot.ACCEPTE, "REGLES", "Sami",
                Instant.now(), 2.1, 12, List.of(8L), etapes));
        when(dispatch.accepter(utilisateur.getName(), 71L)).thenThrow(MarketplaceException.conflit("Offre expirée"));
        http.perform(put("/api/livreur/offres/70/accepter").principal(utilisateur)).andExpect(status().isOk())
                .andExpect(jsonPath("$.statut").value("ACCEPTE")).andExpect(jsonPath("$.commandes[0]").value(8));
        http.perform(put("/api/livreur/offres/71/accepter").principal(utilisateur)).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ETAT_INVALIDE"));
        http.perform(put("/api/livreur/offres/70/refuser").principal(utilisateur).contentType("application/json").content("{\"motif\":\"Trop loin\"}"))
                .andExpect(status().isNoContent());
        verify(dispatch).refuser(utilisateur.getName(), 70L, new RefusOffreRequest("Trop loin"));
        http.perform(put("/api/livreur/offres/72/refuser").principal(utilisateur)).andExpect(status().isNoContent());
        verify(dispatch).refuser(utilisateur.getName(), 72L, null);
    }

    @Test void lotsEnCours() throws Exception {
        when(dispatch.lotsEnCours(utilisateur.getName())).thenReturn(List.of());
        http.perform(get("/api/livreur/lots").principal(utilisateur)).andExpect(status().isOk()).andExpect(content().json("[]"));
    }
}
