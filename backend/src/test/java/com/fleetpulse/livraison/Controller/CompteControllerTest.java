package com.fleetpulse.livraison.Controller;

import static com.fleetpulse.livraison.support.DonneesTest.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fleetpulse.livraison.Dto.CompteResponse;
import com.fleetpulse.livraison.Model.enums.*;
import com.fleetpulse.livraison.Service.*;
import java.util.List;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.test.web.servlet.MockMvc;

@ExtendWith(MockitoExtension.class)
class CompteControllerTest extends ControleurTestSupport {
    @Mock CompteService service; @Mock AuditService audit; @InjectMocks CompteController controleur; MockMvc http;
    @BeforeEach void preparer() { http = http(controleur); }
    @Test void listesFiltreesEtDetailAbsent() throws Exception {
        when(service.lister(Role.CLIENT, StatutCompte.ACTIF)).thenReturn(List.of(CompteResponse.from(client())));
        when(service.detail(1L)).thenReturn(CompteResponse.from(client())); when(service.detail(99L)).thenThrow(new CompteService.CompteIntrouvableException());
        when(service.dossiersOuverts()).thenReturn(List.of());
        http.perform(get("/api/admin/comptes").param("role","CLIENT").param("statut","ACTIF")).andExpect(jsonPath("$[0].id").value(1));
        http.perform(get("/api/admin/comptes/1")).andExpect(jsonPath("$.email").value("client@test.tn"));
        http.perform(get("/api/admin/comptes/99")).andExpect(status().isNotFound());
        http.perform(get("/api/admin/dossiers")).andExpect(content().json("[]"));
    }
    @ParameterizedTest @ValueSource(strings={"valider","refuser","complement","suspendre","reactiver"})
    void decisionsTransmettentMotifEtAuteur(String action) throws Exception {
        var vue = CompteResponse.from(client()); String chemin = "/api/admin/dossiers/1/";
        switch(action) {
            case "valider" -> when(service.valider(1L)).thenReturn(vue);
            case "refuser" -> when(service.refuser(1L,"Motif explicite")).thenReturn(vue);
            case "complement" -> when(service.demanderComplement(1L,"Motif explicite")).thenReturn(vue);
            case "suspendre" -> { chemin="/api/admin/comptes/1/"; when(service.suspendre(1L,"Motif explicite",utilisateur)).thenReturn(vue); }
            case "reactiver" -> { chemin="/api/admin/comptes/1/"; when(service.reactiver(1L,"Motif explicite",utilisateur)).thenReturn(vue); }
        }
        http.perform(put(chemin+action).principal(utilisateur).contentType("application/json").content("{\"motif\":\"Motif explicite\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(1));
    }
    @Test void creationResponsableEtConsultationAudit() throws Exception {
        when(service.creerResponsable(any())).thenReturn(CompteResponse.from(client()));
        when(audit.rechercher(null,null,null,null)).thenReturn(List.of());
        when(audit.page(null,null,null,null,0,20)).thenReturn(Page.empty());
        http.perform(post("/api/admin/responsables").contentType("application/json").content("{\"email\":\"ops@test.tn\",\"sousRole\":\"OPERATIONS\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.id").value(1));
        http.perform(get("/api/admin/audit")).andExpect(status().isOk()).andExpect(content().json("[]"));
        http.perform(get("/api/admin/audit/page")).andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
    }
    @Test void filtreInvalideRetourne400() throws Exception {
        http.perform(get("/api/admin/comptes").param("role","INCONNU")).andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }
}
