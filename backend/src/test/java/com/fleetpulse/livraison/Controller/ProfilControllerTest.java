package com.fleetpulse.livraison.Controller;

import static com.fleetpulse.livraison.support.DonneesTest.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fleetpulse.livraison.Dto.ProfilResponse;
import com.fleetpulse.livraison.Service.ProfilService;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ProfilControllerTest extends ControleurTestSupport {
    @Mock ProfilService service; @InjectMocks ProfilController controleur;
    @Test void profilPublicDuCompteConnecteEtCompteAbsent() throws Exception {
        when(service.findByEmail(utilisateur.getName())).thenReturn(Optional.of(ProfilResponse.from(livreur())), Optional.empty());
        var http = http(controleur);
        http.perform(get("/api/me").principal(utilisateur)).andExpect(status().isOk()).andExpect(jsonPath("$.role").value("LIVREUR"))
                .andExpect(jsonPath("$.motDePasseHash").doesNotExist());
        http.perform(get("/api/me").principal(utilisateur)).andExpect(status().isNotFound());
    }
}
