package com.fleetpulse.livraison.Service;

import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import com.fleetpulse.livraison.Dto.SuiviDto.PositionCommande;
import com.fleetpulse.livraison.Model.enums.*;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

@ExtendWith(MockitoExtension.class)
class DiffusionTempsReelTest {
    @Mock SimpMessagingTemplate messages; @InjectMocks DiffusionTempsReel service;
    @Test void quartierChaqueMembreNeRecoitQueSonPropreIdentifiantDeCommande() {
        service.actualiserMembresQuartier(new QuartierService.GroupeChange(1L, java.util.List.of(
                new QuartierService.MembreActualise("a@test", 10L, StatutLivraison.PRETE),
                new QuartierService.MembreActualise("b@test", 20L, StatutLivraison.PRETE))));
        verify(messages).convertAndSendToUser("a@test", "/queue/commandes", new com.fleetpulse.livraison.Dto.EvenementCommande(10L, StatutLivraison.PRETE, StatutLivraison.PRETE));
        verify(messages).convertAndSendToUser("b@test", "/queue/commandes", new com.fleetpulse.livraison.Dto.EvenementCommande(20L, StatutLivraison.PRETE, StatutLivraison.PRETE));
        verifyNoMoreInteractions(messages);
    }
    @Test void changementDiffuseAuxSeulsActeursConcernes() {
        service.diffuser(new CommandeStatutChange(8L,3L,"partenaire@test.tn",1L,"client@test.tn","livreur@test.tn",StatutLivraison.PRETE,StatutLivraison.AFFECTEE,Role.LIVREUR));
        verify(messages).convertAndSendToUser(eq("partenaire@test.tn"),eq("/queue/commandes"),any(Object.class));
        verify(messages).convertAndSendToUser(eq("client@test.tn"),eq("/queue/commandes"),any(Object.class));
        verify(messages).convertAndSendToUser(eq("livreur@test.tn"),eq("/queue/commandes"),any(Object.class));
    }
    @Test void ancienneCommandeSansPartenaireNiLivreurEtPositionClient() {
        service.diffuser(new CommandeStatutChange(8L,null,null,1L,"client@test.tn",null,StatutLivraison.PRETE,StatutLivraison.AFFECTEE,Role.LIVREUR));
        var p=new PositionCommande(8L,36.8,10.18,Instant.now(),null);
        service.diffuserPosition(new SuiviPositionService.PositionDiffusee("client@test.tn",p));
        verify(messages).convertAndSendToUser("client@test.tn","/queue/positions",p);
        verify(messages,times(2)).convertAndSendToUser(eq("client@test.tn"),anyString(),any(Object.class));
        verifyNoMoreInteractions(messages);
    }
}
