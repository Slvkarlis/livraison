package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Repository.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.*;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class InvitationsQuartierServiceTest {
    final InvitationsQuartierService service = new InvitationsQuartierService();
    final GroupeQuartierRepository groupes = mock(GroupeQuartierRepository.class);
    final InvitationQuartierRepository invitations = mock(InvitationQuartierRepository.class);
    final AdresseLivraisonRepository adresses = mock(AdresseLivraisonRepository.class);
    final ClientRepository clients = mock(ClientRepository.class);
    final NotificationService notifications = mock(NotificationService.class);
    final GroupeQuartier g = new GroupeQuartier(); final Client client = new Client();
    @BeforeEach void preparer() {
        ReflectionTestUtils.setField(service, "groupes", groupes); ReflectionTestUtils.setField(service, "invitations", invitations);
        ReflectionTestUtils.setField(service, "adresses", adresses); ReflectionTestUtils.setField(service, "clients", clients);
        ReflectionTestUtils.setField(service, "notifications", notifications);
        client.setId(9L); client.setEmail("destinataire@test"); client.setNom("SECRET");
        AdresseLivraison a = new AdresseLivraison(); a.setClient(client); a.setLatitude(36.8001); a.setLongitude(10.18);
        when(adresses.findAll()).thenReturn(List.of(a, a)); when(clients.verrouiller(client.getEmail())).thenReturn(Optional.of(client));
        Zone zone = mock(Zone.class); when(zone.contient(anyDouble(), anyDouble())).thenReturn(true);
        g.setId(1L); g.setZone(zone); g.setLatitude(36.80); g.setLongitude(10.18); g.setRayonMetres(400);
        g.setExpiration(Instant.now().plusSeconds(60)); g.setReductionDeux(new BigDecimal("0.40"));
        Partenaire p = new Partenaire(); p.setNomCommerce("Commerce public"); g.setCommerce(p);
        Livraison c = new Livraison(); Client voisin = new Client(); voisin.setId(3L); c.setClient(voisin); g.getCommandes().add(c);
        when(groupes.findById(anyLong())).thenReturn(Optional.of(g));
    }
    @Test void plafondDeuxParJourEtUneInvitationParGroupeMalgreDeuxAdresses() {
        AtomicLong nb = new AtomicLong();
        when(invitations.countByClientIdAndEnvoyeeLeGreaterThanEqualAndEnvoyeeLeLessThan(eq(9L), any(), any())).thenAnswer(a -> nb.get());
        when(invitations.save(any())).thenAnswer(a -> { nb.incrementAndGet(); return a.getArgument(0); });
        for (long id = 1; id <= 3; id++) { g.setId(id); service.inviter(new QuartierService.GroupeChange(id)); }
        assertEquals(2, nb.get()); verify(notifications, times(2)).inviterQuartier(eq(client), anyLong(), anyString());
    }
    @Test void preferenceDesactiveeEtDedoublonnagePersistant() {
        client.setRecevoirInvitationsQuartier(false); service.inviter(new QuartierService.GroupeChange(1L));
        verifyNoInteractions(notifications);
        client.setRecevoirInvitationsQuartier(true); when(invitations.existsByClientIdAndGroupeId(9L, 1L)).thenReturn(true);
        service.inviter(new QuartierService.GroupeChange(1L)); verifyNoInteractions(notifications);
    }
    @Test void membreDuGroupeEtClientHorsRayonNeSontPasInvites() {
        client.setId(3L); service.inviter(new QuartierService.GroupeChange(1L)); verifyNoInteractions(notifications);
        client.setId(9L); g.setLatitude(36.90); service.inviter(new QuartierService.GroupeChange(1L)); verifyNoInteractions(notifications);
    }
}
