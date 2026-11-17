package com.fleetpulse.livraison.Controller;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fleetpulse.livraison.Dto.GestionCommandeDto.*;
import com.fleetpulse.livraison.Model.enums.StatutLivraison;
import com.fleetpulse.livraison.Service.*;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;

@ExtendWith(MockitoExtension.class)
class GestionCommandeControllerTest extends ControleurTestSupport {
    @Mock GestionCommandeService service; @InjectMocks GestionCommandeController controleur; MockMvc http;
    final SuiviResponsable vue = new SuiviResponsable(8L,"FP-TEST-0001",StatutLivraison.AFFECTEE,"Sami",null,null,
            new BigDecimal("11.500"),null,null,null,null,null,null,List.of(ActionResponsable.ANNULER),List.of());
    @BeforeEach void preparer() { http=http(controleur); }
    @Test void suiviAvecActionsPossiblesEtCommandeAbsente() throws Exception {
        when(service.suivi(8L)).thenReturn(vue); when(service.suivi(99L)).thenThrow(MarketplaceException.absent());
        http.perform(get("/api/admin/commandes/8/suivi")).andExpect(jsonPath("$.actions[0]").value("ANNULER"));
        http.perform(get("/api/admin/commandes/99/suivi")).andExpect(status().isNotFound());
    }
    @Test void interventionsAvecMotifEtMontant() throws Exception {
        when(service.annuler(eq(utilisateur.getName()),eq(8L),any())).thenReturn(vue);
        when(service.validerCollecte(eq(utilisateur.getName()),eq(8L),any())).thenReturn(vue);
        when(service.validerRemise(eq(utilisateur.getName()),eq(8L),any())).thenReturn(vue);
        for(String action:List.of("annuler","collecte"))
            http.perform(put("/api/admin/commandes/8/"+action).principal(utilisateur).contentType("application/json").content("{\"motif\":\"Intervention justifiée\"}"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.commandeId").value(8));
        http.perform(put("/api/admin/commandes/8/remise").principal(utilisateur).contentType("application/json").content("{\"motif\":\"Intervention justifiée\",\"montantEncaisse\":11.500}"))
                .andExpect(status().isOk());
        verify(service).validerRemise(utilisateur.getName(),8L,new RemiseManuelleRequest("Intervention justifiée",new BigDecimal("11.500"),null));
    }
}
