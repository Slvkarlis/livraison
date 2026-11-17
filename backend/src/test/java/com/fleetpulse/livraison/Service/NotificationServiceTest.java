package com.fleetpulse.livraison.Service;

import static com.fleetpulse.livraison.support.DonneesTest.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.fleetpulse.livraison.Dto.NotificationDto.AppareilRequest;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.*;
import com.fleetpulse.livraison.Repository.*;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;
import org.springframework.messaging.simp.SimpMessagingTemplate;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {
    @Mock NotificationRepository notifications; @Mock AppareilNotificationRepository appareils;
    @Mock UtilisateurRepository utilisateurs; @Mock LivraisonRepository commandes;
    @Mock SimpMessagingTemplate messages; @Mock PushSender push; @InjectMocks NotificationService service;
    final String jeton = "ExponentPushToken[abcdefghijklmnop]";
    void compte() { when(utilisateurs.findByEmail("client@test.tn")).thenReturn(Optional.of(client())); }
    @Test void boiteEtLectureAppartiennentAuCompteConnecte() {
        compte(); when(notifications.countByDestinataireIdAndLueLeIsNull(1L)).thenReturn(1L);
        when(notifications.findAllByDestinataireIdOrderByCreeLeDescIdDesc(eq(1L), any(Pageable.class)))
                .thenReturn(List.of(new Notification(client(), 8L, StatutLivraison.PRETE, "Prête", "Votre colis est prêt", Instant.now())));
        assertEquals(1, service.boite("client@test.tn").nonLues());
        assertEquals("Prête", service.boite("client@test.tn").notifications().getFirst().titre());
        service.marquerLues("client@test.tn"); verify(notifications).marquerLues(eq(1L), any());
    }
    @Test void appareilPartageTransfereAuCompteEtRetraitProtege() {
        compte(); AppareilNotification a = new AppareilNotification(); a.setJeton(jeton); a.setUtilisateur(livreur());
        when(appareils.findByJeton(jeton)).thenReturn(Optional.of(a));
        service.retirerAppareil("client@test.tn", new AppareilRequest(jeton)); verify(appareils, never()).delete(any());
        service.enregistrerAppareil("client@test.tn", new AppareilRequest(jeton)); assertEquals(1L, a.getUtilisateur().getId());
        verify(appareils).save(a); service.retirerAppareil("client@test.tn", new AppareilRequest(jeton)); verify(appareils).delete(a);
    }
    @Test void jetonInvalideEtUtilisateurAbsent() {
        assertThrows(IllegalArgumentException.class, () -> service.enregistrerAppareil("client", new AppareilRequest("invalide")));
        assertThrows(MarketplaceException.class, () -> service.boite("absent")); verifyNoInteractions(appareils);
    }
    CommandeStatutChange evenement(Role role, StatutLivraison ancien, StatutLivraison nouveau) {
        return new CommandeStatutChange(8L, 3L, "partenaire@test.tn", 1L, "client@test.tn", "livreur@test.tn", ancien, nouveau, role);
    }
    @Test void aucuneNotificationPourNoteOuActionDuClient() {
        service.notifier(evenement(Role.PARTENAIRE, StatutLivraison.ACCEPTEE, StatutLivraison.ACCEPTEE));
        service.notifier(evenement(Role.CLIENT, StatutLivraison.ACCEPTEE, StatutLivraison.ANNULEE));
        verifyNoInteractions(commandes, notifications, messages, push);
    }
    @Test void changementEnregistreEtDiffuseNotificationPuisRetireJetonInvalide() {
        when(commandes.findById(8L)).thenReturn(Optional.of(commande(StatutLivraison.AFFECTEE)));
        when(notifications.save(any())).thenAnswer(i -> { Notification n = i.getArgument(0); n.setId(10L); return n; });
        AppareilNotification a = new AppareilNotification(); a.setJeton(jeton); a.setUtilisateur(client());
        when(appareils.findAllByUtilisateurId(1L)).thenReturn(List.of(a));
        when(push.envoyer(anyList(), anyString(), anyString(), anyMap())).thenReturn(List.of(jeton));
        when(appareils.findByJeton(jeton)).thenReturn(Optional.of(a));
        service.notifier(evenement(Role.PARTENAIRE, StatutLivraison.PENDING_PARTNER, StatutLivraison.ACCEPTEE));
        verify(notifications).save(argThat(n -> n.getDestinataire().getId().equals(1L)));
        verify(messages).convertAndSendToUser(eq("client@test.tn"), eq("/queue/notifications"), any(Object.class));
        verify(appareils).delete(a);
    }
    @Test void echecNotificationNeRemontePasAuParcoursCommande() {
        when(commandes.findById(8L)).thenThrow(new IllegalStateException("indisponible"));
        assertDoesNotThrow(() -> service.notifier(evenement(Role.PARTENAIRE, StatutLivraison.ACCEPTEE, StatutLivraison.PRETE)));
    }
}
