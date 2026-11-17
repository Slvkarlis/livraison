package com.fleetpulse.livraison.Controller;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fleetpulse.livraison.Dto.EntrepotDto.*;
import com.fleetpulse.livraison.Model.enums.TypeEvenement;
import com.fleetpulse.livraison.Service.EntrepotService;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;

@ExtendWith(MockitoExtension.class)
class EntrepotControllerTest extends ControleurTestSupport {
    @Mock EntrepotService entrepot; @InjectMocks EntrepotController controleur; MockMvc http;
    @BeforeEach void preparer() { http = http(controleur); }

    @Test void evenementsFiltresParDateEtType() throws Exception {
        Instant depuis = Instant.parse("2026-11-17T08:00:00Z");
        when(entrepot.evenements(depuis, TypeEvenement.OFFRE, 50)).thenReturn(List.of(new EvenementVue(1L, TypeEvenement.OFFRE,
                depuis, 8L, 4L, 2L, 50L, 0.4, "PROPOSEE", null)));
        http.perform(get("/api/admin/entrepot/evenements").param("depuis", "2026-11-17T08:00:00Z").param("type", "OFFRE").param("limite", "50"))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].code").value("PROPOSEE"));
        http.perform(get("/api/admin/entrepot/evenements").param("type", "INCONNU")).andExpect(status().isBadRequest());
    }

    @Test void jeuEtaEtExport() throws Exception {
        when(entrepot.jeuEta(null)).thenReturn(List.of(new EchantillonEta(8L, 3L, 2L, 12, 2, 10, 12.0, 1.4, 20, 1, 3.0, 12.0)));
        http.perform(get("/api/admin/entrepot/jeu-eta")).andExpect(status().isOk()).andExpect(jsonPath("$[0].trajetReelMin").value(12.0));
        when(entrepot.exporter(null)).thenReturn(new ExportEntrepot(Instant.now(), Instant.EPOCH, List.of(), List.of(), List.of(),
                List.of(new ZoneExport(2L, "Tunis", 20, List.of(3L)))));
        http.perform(get("/api/admin/entrepot/export")).andExpect(status().isOk()).andExpect(jsonPath("$.zones[0].voisines[0]").value(3));
    }
}
