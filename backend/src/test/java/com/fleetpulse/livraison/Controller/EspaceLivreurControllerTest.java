package com.fleetpulse.livraison.Controller;

import static com.fleetpulse.livraison.support.DonneesTest.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fleetpulse.livraison.Dto.EspaceLivreurDto.*;
import com.fleetpulse.livraison.Model.enums.StatutLivraison;
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
class EspaceLivreurControllerTest extends ControleurTestSupport {
    @Mock EspaceLivreurService service; @Mock SuiviPositionService suiviPosition; @Mock RemiseLivreurService remise;
    @InjectMocks EspaceLivreurController controleur; MockMvc http;
    @BeforeEach void preparer() { http = http(controleur); }
    @Test void disponibiliteEtCoordonneesTransmises() throws Exception {
        var vue = new DisponibiliteVue(true, Instant.now(), List.of());
        when(service.disponibilite(utilisateur.getName())).thenReturn(vue);
        when(service.changerDisponibilite(eq(utilisateur.getName()), any())).thenReturn(vue);
        http.perform(get("/api/livreur/disponibilite").principal(utilisateur)).andExpect(status().isOk()).andExpect(jsonPath("$.disponible").value(true));
        http.perform(put("/api/livreur/disponibilite").principal(utilisateur).contentType("application/json").content("{\"disponible\":true,\"latitude\":36.8,\"longitude\":10.18}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.disponible").value(true));
        verify(service).changerDisponibilite(utilisateur.getName(), new DisponibiliteRequest(true, 36.8, 10.18));
    }
    @Test void missionsEtMissionAbsente() throws Exception {
        var vue = MissionVue.from(commande(StatutLivraison.AFFECTEE));
        when(service.missions(utilisateur.getName())).thenReturn(List.of(vue)); when(service.mission(utilisateur.getName(), 8L)).thenReturn(vue);
        when(service.mission(utilisateur.getName(), 99L)).thenThrow(MarketplaceException.absent());
        http.perform(get("/api/livreur/missions").principal(utilisateur)).andExpect(jsonPath("$[0].id").value(8));
        http.perform(get("/api/livreur/missions/8").principal(utilisateur)).andExpect(jsonPath("$.nomCommerce").value("Chez Amira"));
        http.perform(get("/api/livreur/missions/99").principal(utilisateur)).andExpect(status().isNotFound());
    }
    @Test void collecteEtRemiseTransmettentLaPreuve() throws Exception {
        var vue = MissionVue.from(commande(StatutLivraison.RECUPEREE));
        when(service.confirmerCollecte(eq(utilisateur.getName()), eq(8L), any())).thenReturn(vue);
        when(remise.valider(eq(utilisateur.getName()), eq(8L), any())).thenReturn(vue);
        http.perform(post("/api/livreur/missions/8/collecte").principal(utilisateur).contentType("application/json").content("{\"code\":\"K7Q2MX\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.statut").value("RECUPEREE"));
        verify(service).confirmerCollecte(utilisateur.getName(), 8L, new CollecteRequest("K7Q2MX"));
        http.perform(post("/api/livreur/missions/8/remise").principal(utilisateur).contentType("application/json").content("{\"montantEncaisse\":11.500,\"preuve\":\"123456\"}"))
                .andExpect(status().isOk());
        verify(remise).valider(utilisateur.getName(), 8L, new RemiseRequest(new BigDecimal("11.500"), null, "123456"));
    }
    @Test void positionAccepteeOuEcarteeResteUneReponseMetier() throws Exception {
        when(suiviPosition.enregistrer(eq(utilisateur.getName()), any())).thenReturn(new PositionVue(false,"Position trop imprécise",Instant.now(),true));
        http.perform(put("/api/livreur/position").principal(utilisateur).contentType("application/json").content("{\"latitude\":36.8,\"longitude\":10.18,\"precision\":200}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.acceptee").value(false));
        verify(suiviPosition).enregistrer(utilisateur.getName(), new PositionRequest(36.8,10.18,200.));
    }
}
