package com.fleetpulse.livraison.Controller;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fleetpulse.livraison.Dto.AffectationZoneDto.*;
import com.fleetpulse.livraison.Model.enums.TypeAffectation;
import com.fleetpulse.livraison.Service.*;
import java.util.List;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;

@ExtendWith(MockitoExtension.class)
class AffectationZoneControllerTest extends ControleurTestSupport {
    @Mock AffectationZoneService service; @InjectMocks AffectationZoneController controleur; MockMvc http;
    final AffectationVue vue = new AffectationVue(10L, 2L, "Tunis", TypeAffectation.PRINCIPALE, null, null, true);
    @BeforeEach void preparer() { http = http(controleur); }
    @Test void listeAffectationsDuLivreur() throws Exception {
        when(service.lister(4L)).thenReturn(List.of(vue));
        http.perform(get("/api/admin/livreurs/4/zones")).andExpect(status().isOk()).andExpect(jsonPath("$[0].zoneNom").value("Tunis"));
    }
    @Test void creationEtSuppression() throws Exception {
        when(service.affecter(eq(4L), any())).thenReturn(vue);
        http.perform(post("/api/admin/livreurs/4/zones").contentType("application/json").content("{\"zoneId\":2,\"type\":\"PRINCIPALE\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.id").value(10));
        verify(service).affecter(4L, new AffectationRequest(2L, TypeAffectation.PRINCIPALE, null, null));
        http.perform(delete("/api/admin/livreurs/4/zones/10")).andExpect(status().isNoContent()); verify(service).retirer(4L, 10L);
    }
    @Test void ressourceAbsenteEtEnumInvalide() throws Exception {
        when(service.lister(99L)).thenThrow(MarketplaceException.absent());
        http.perform(get("/api/admin/livreurs/99/zones")).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("INTROUVABLE"));
        http.perform(post("/api/admin/livreurs/4/zones").contentType("application/json").content("{\"zoneId\":2,\"type\":\"INCONNUE\"}"))
                .andExpect(status().isBadRequest());
    }
}
