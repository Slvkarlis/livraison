package com.fleetpulse.livraison.Service;

import static com.fleetpulse.livraison.support.DonneesTest.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.fleetpulse.livraison.Dto.EspaceLivreurDto.PositionRequest;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.StatutLivraison;
import com.fleetpulse.livraison.Repository.*;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

@ExtendWith(MockitoExtension.class)
class SuiviPositionServiceTest {
    @Mock LivreurRepository livreurs; @Mock LivraisonRepository commandes; @Mock PositionLivreurRepository positions;
    @Mock SuiviCommandeService suiviCommandes; @Mock CommandeWorkflow workflow; @Mock ApplicationEventPublisher evenements;
    @InjectMocks SuiviPositionService service;
    @Test void sansMissionMetAJourSansHistoriser() {
        Livreur l = livreur(); when(livreurs.findByEmail(l.getEmail())).thenReturn(Optional.of(l));
        var vue = service.enregistrer(l.getEmail(), new PositionRequest(36.8, 10.18, 10.));
        assertTrue(vue.acceptee()); assertFalse(vue.enMission()); verifyNoInteractions(positions, evenements);
    }
    @Test void precisionInsuffisanteEtSautGpsRefuses() {
        Livreur l = livreur(); when(livreurs.findByEmail(l.getEmail())).thenReturn(Optional.of(l));
        assertFalse(service.enregistrer(l.getEmail(), new PositionRequest(36.8, 10.18, 200.)).acceptee());
        assertFalse(service.enregistrer(l.getEmail(), new PositionRequest(48., 2., 10.)).acceptee()); verifyNoInteractions(positions);
    }
    @Test void positionPendantMissionHistoriseeEtProximiteDiffusee() {
        Livreur l = livreur(); l.setDernierePositionLe(Instant.now().minusSeconds(3600));
        Livraison c = commande(StatutLivraison.RECUPEREE);
        when(livreurs.findByEmail(l.getEmail())).thenReturn(Optional.of(l));
        when(commandes.countByLivreurIdAndStatutIn(eq(4L), any())).thenReturn(1L);
        when(commandes.findAllByLivreurIdAndStatutInOrderByAffecteeLeAsc(eq(4L), any())).thenReturn(List.of(c));
        when(commandes.verrouiller(8L)).thenReturn(Optional.of(c));
        assertTrue(service.enregistrer(l.getEmail(), new PositionRequest(36.81, 10.19, 10.)).acceptee());
        verify(positions).save(argThat(p -> p.getLatitude() == 36.81));
        verify(workflow).transition(eq(c), eq(StatutLivraison.A_PROXIMITE), eq(l), anyString());
        verify(evenements).publishEvent(any(SuiviPositionService.PositionDiffusee.class));
    }
    @Test void coordonneesInvalidesEtCompteAbsent() {
        assertThrows(IllegalArgumentException.class, () -> service.enregistrer("x", null));
        assertThrows(IllegalArgumentException.class, () -> service.enregistrer("x", new PositionRequest(91., 0., 10.)));
        assertThrows(MarketplaceException.class, () -> service.enregistrer("x", new PositionRequest(36., 10., 10.)));
    }
}
