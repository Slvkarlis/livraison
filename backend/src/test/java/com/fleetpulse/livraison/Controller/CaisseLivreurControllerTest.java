package com.fleetpulse.livraison.Controller;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fleetpulse.livraison.Dto.FinanceDto.*;
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
class CaisseLivreurControllerTest extends ControleurTestSupport {
    @Mock CaisseService caisses; @InjectMocks CaisseLivreurController controleur; MockMvc http;
    @BeforeEach void preparer() { http = http(controleur); }

    @Test void caisseDuLivreurConnecte() throws Exception {
        when(caisses.caisseDuLivreur(utilisateur.getName())).thenReturn(new CaisseLivreurVue(new BigDecimal("11.500"),
                List.of(new CommandeEncaisseeVue(8L, "FP-1", "Chez Amira", Instant.now(), new BigDecimal("11.500"), BigDecimal.ZERO)),
                List.of(), 1, new BigDecimal("3.926"), List.of()));
        http.perform(get("/api/livreur/caisse").principal(utilisateur)).andExpect(status().isOk())
                .andExpect(jsonPath("$.solde").value(11.5)).andExpect(jsonPath("$.commandes[0].codeSuivi").value("FP-1"))
                .andExpect(jsonPath("$.remunerationEnAttente").value(3.926));
        when(caisses.caisseDuLivreur(utilisateur.getName())).thenThrow(MarketplaceException.absent());
        http.perform(get("/api/livreur/caisse").principal(utilisateur)).andExpect(status().isNotFound());
    }
}
