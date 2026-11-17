package com.fleetpulse.livraison.Controller;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fleetpulse.livraison.Dto.NotificationDto.*;
import com.fleetpulse.livraison.Service.NotificationService;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;

@ExtendWith(MockitoExtension.class)
class NotificationControllerTest extends ControleurTestSupport {
    @Mock NotificationService service; @InjectMocks NotificationController controleur; MockMvc http;
    @BeforeEach void preparer() { http = http(controleur); }
    @Test void boiteAvecCompteurEtContenu() throws Exception {
        when(service.boite(utilisateur.getName())).thenReturn(new BoiteNotifications(1, List.of(new NotificationVue(10L,8L,null,"Commande prête","Votre commande est prête",Instant.now(),false))));
        http.perform(get("/api/notifications").principal(utilisateur)).andExpect(status().isOk())
                .andExpect(jsonPath("$.nonLues").value(1)).andExpect(jsonPath("$.notifications[0].commandeId").value(8));
    }
    @Test void lectureEtAppareilsSansCorpsDeReponse() throws Exception {
        http.perform(put("/api/notifications/lues").principal(utilisateur)).andExpect(status().isNoContent());
        verify(service).marquerLues(utilisateur.getName());
        String json = "{\"jeton\":\"ExponentPushToken[abcdefghijklmnop]\"}";
        http.perform(put("/api/notifications/appareil").principal(utilisateur).contentType("application/json").content(json)).andExpect(status().isNoContent());
        http.perform(delete("/api/notifications/appareil").principal(utilisateur).contentType("application/json").content(json)).andExpect(status().isNoContent());
        verify(service).enregistrerAppareil(utilisateur.getName(), new AppareilRequest("ExponentPushToken[abcdefghijklmnop]"));
        verify(service).retirerAppareil(utilisateur.getName(), new AppareilRequest("ExponentPushToken[abcdefghijklmnop]"));
    }
    @Test void jetonInvalideTraduitEn400() throws Exception {
        doThrow(new IllegalArgumentException("Jeton invalide")).when(service).enregistrerAppareil(anyString(), any());
        http.perform(put("/api/notifications/appareil").principal(utilisateur).contentType("application/json").content("{\"jeton\":\"x\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value("Jeton invalide"));
    }
}
