package com.fleetpulse.livraison.Controller;

import static com.fleetpulse.livraison.support.DonneesTest.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fleetpulse.livraison.Dto.CommandePartenaireDto.*;
import com.fleetpulse.livraison.Model.enums.StatutLivraison;
import com.fleetpulse.livraison.Service.*;
import java.util.List;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;

@ExtendWith(MockitoExtension.class)
class CommandePartenaireControllerTest extends ControleurTestSupport {
    @Mock CommandePartenaireService service; @InjectMocks CommandePartenaireController controleur; MockMvc http;
    @BeforeEach void preparer() { http = http(controleur); }
    @Test void listeTransmetIdentiteEtFiltre() throws Exception {
        when(service.lister(utilisateur.getName(), List.of(StatutLivraison.PRETE)))
                .thenReturn(List.of(CommandeResume.from(commande(StatutLivraison.PRETE))));
        http.perform(get("/api/partenaire/commandes").param("statut", "PRETE").principal(utilisateur))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].statut").value("PRETE"));
    }
    @Test void detailEtCommandeAbsente() throws Exception {
        when(service.detail(utilisateur.getName(), 8L)).thenReturn(CommandeDetail.from(commande(StatutLivraison.ACCEPTEE), List.of()));
        when(service.detail(utilisateur.getName(), 99L)).thenThrow(MarketplaceException.absent());
        http.perform(get("/api/partenaire/commandes/8").principal(utilisateur)).andExpect(status().isOk()).andExpect(jsonPath("$.clientPrenom").value("Amal"));
        http.perform(get("/api/partenaire/commandes/99").principal(utilisateur)).andExpect(status().isNotFound());
    }
    @ParameterizedTest @ValueSource(strings = {"accepter", "refuser", "preparation/debut", "preparation/temps", "prete"})
    void actionsTransmettentIdentiteCommandeEtCorps(String action) throws Exception {
        var vue = CommandeDetail.from(commande(StatutLivraison.PRETE), List.of());
        String json = "{\"tempsPreparationMinutes\":15}";
        switch (action) {
            case "accepter" -> when(service.accepter(eq(utilisateur.getName()), eq(8L), any())).thenReturn(vue);
            case "refuser" -> { json = "{\"motif\":\"AUTRE\",\"commentaire\":\"Stock épuisé\"}"; when(service.refuser(eq(utilisateur.getName()), eq(8L), any())).thenReturn(vue); }
            case "preparation/debut" -> when(service.commencerPreparation(utilisateur.getName(), 8L)).thenReturn(vue);
            case "preparation/temps" -> when(service.ajusterPreparation(eq(utilisateur.getName()), eq(8L), any())).thenReturn(vue);
            case "prete" -> when(service.marquerPrete(utilisateur.getName(), 8L)).thenReturn(vue);
        }
        http.perform(put("/api/partenaire/commandes/8/" + action).principal(utilisateur).contentType("application/json").content(json))
                .andExpect(status().isOk()).andExpect(jsonPath("$.codeSuivi").value("FP-TEST-0001"));
        if (action.equals("accepter")) verify(service).accepter(utilisateur.getName(), 8L, new TempsPreparationRequest(15));
        if (action.equals("preparation/temps")) verify(service).ajusterPreparation(utilisateur.getName(), 8L, new TempsPreparationRequest(15));
    }
    @Test void etiquetteEtConflitDEtat() throws Exception {
        when(service.etiquette(utilisateur.getName(), 8L)).thenReturn(EtiquetteColis.from(commande(StatutLivraison.PRETE), "QR-COLLECTE"));
        http.perform(get("/api/partenaire/commandes/8/etiquette").principal(utilisateur)).andExpect(jsonPath("$.contenuQr").value("QR-COLLECTE"));
        when(service.marquerPrete(utilisateur.getName(), 8L)).thenThrow(MarketplaceException.conflit("Commande annulée"));
        http.perform(put("/api/partenaire/commandes/8/prete").principal(utilisateur)).andExpect(status().isConflict()).andExpect(jsonPath("$.message").value("Commande annulée"));
    }
}
