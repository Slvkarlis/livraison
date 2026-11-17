package com.fleetpulse.livraison.Controller;

import static com.fleetpulse.livraison.support.DonneesTest.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fleetpulse.livraison.Dto.LivraisonResponse;
import com.fleetpulse.livraison.Model.enums.StatutLivraison;
import com.fleetpulse.livraison.Service.LivraisonService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class LivraisonControllerTest extends ControleurTestSupport {
    @Mock LivraisonService service; @InjectMocks LivraisonController controleur;
    @Test void listeResponsableEtListeClientUtilisentLesBonnesSources() throws Exception {
        var vue = LivraisonResponse.from(commande(StatutLivraison.PRETE));
        when(service.listAll()).thenReturn(List.of(vue)); when(service.listForClient(utilisateur.getName())).thenReturn(List.of());
        var http = http(controleur);
        http.perform(get("/api/livraisons")).andExpect(status().isOk()).andExpect(jsonPath("$[0].statut").value("PRETE"));
        http.perform(get("/api/livraisons/mes").principal(utilisateur)).andExpect(status().isOk()).andExpect(content().json("[]"));
        verify(service).listForClient(utilisateur.getName());
    }
}
