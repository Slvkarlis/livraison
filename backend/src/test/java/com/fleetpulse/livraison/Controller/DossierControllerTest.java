package com.fleetpulse.livraison.Controller;

import static com.fleetpulse.livraison.support.DonneesTest.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fleetpulse.livraison.Dto.CompteResponse;
import com.fleetpulse.livraison.Service.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class DossierControllerTest extends ControleurTestSupport {
    @Mock CompteService service; @InjectMocks DossierController controleur;
    @Test void consultationEtCorrectionUtilisentLeTitulaireConnecte() throws Exception {
        when(service.monDossier(utilisateur.getName())).thenReturn(CompteResponse.from(partenaire()));
        when(service.corrigerDossier(eq(utilisateur.getName()), any())).thenReturn(CompteResponse.from(partenaire()));
        var http = http(controleur);
        http.perform(get("/api/dossier").principal(utilisateur)).andExpect(status().isOk()).andExpect(jsonPath("$.nomCommerce").value("Chez Amira"));
        http.perform(put("/api/dossier").principal(utilisateur).contentType("application/json").content("{\"nomCommerce\":\"Chez Amira\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(3));
        verify(service).corrigerDossier(eq(utilisateur.getName()), argThat(r -> "Chez Amira".equals(r.nomCommerce())));
    }
    @Test void transitionDeDossierInterditeRetourne409() throws Exception {
        when(service.corrigerDossier(anyString(), any())).thenThrow(new CompteService.TransitionInvalideException("Dossier déjà validé"));
        http(controleur).perform(put("/api/dossier").principal(utilisateur).contentType("application/json").content("{}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ETAT_INVALIDE"));
    }
}
