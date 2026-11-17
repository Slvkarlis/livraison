package com.fleetpulse.livraison.Service;

import static com.fleetpulse.livraison.support.DonneesTest.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.fleetpulse.livraison.Dto.AffectationZoneDto.AffectationRequest;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.TypeAffectation;
import com.fleetpulse.livraison.Repository.*;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AffectationZoneServiceTest {
    @Mock AffectationZoneRepository affectations; @Mock LivreurRepository livreurs;
    @Mock ZoneRepository zones; @Mock AuditService audit; @InjectMocks AffectationZoneService service;
    void disponibles() {
        when(livreurs.findById(4L)).thenReturn(Optional.of(livreur()));
        when(zones.findById(2L)).thenReturn(Optional.of(zone()));
    }
    @Test void listeDuLivreurEtLivreurAbsent() {
        when(livreurs.findById(4L)).thenReturn(Optional.of(livreur()));
        assertTrue(service.lister(4L).isEmpty());
        assertThrows(MarketplaceException.class, () -> service.lister(99L));
    }
    @Test void affectationPrincipaleEtTemporaireValides() {
        disponibles();
        assertEquals("Tunis", service.affecter(4L, new AffectationRequest(2L, TypeAffectation.PRINCIPALE, null, null)).zoneNom());
        Instant debut = Instant.now().minusSeconds(60), fin = Instant.now().plusSeconds(600);
        assertTrue(service.affecter(4L, new AffectationRequest(2L, TypeAffectation.TEMPORAIRE, debut, fin)).enVigueur());
        verify(affectations, times(2)).save(any());
    }
    @Test void doublonEtSecondeZonePrincipaleRefuses() {
        disponibles(); when(affectations.existsByLivreurIdAndZoneId(4L, 2L)).thenReturn(true);
        var r = new AffectationRequest(2L, TypeAffectation.PRINCIPALE, null, null);
        assertThrows(MarketplaceException.class, () -> service.affecter(4L, r));
        when(affectations.existsByLivreurIdAndZoneId(4L, 2L)).thenReturn(false);
        when(affectations.existsByLivreurIdAndType(4L, TypeAffectation.PRINCIPALE)).thenReturn(true);
        assertThrows(MarketplaceException.class, () -> service.affecter(4L, r)); verify(affectations, never()).save(any());
    }
    @Test void requeteEtPeriodeInvalides() {
        assertThrows(IllegalArgumentException.class, () -> service.affecter(4L, null));
        disponibles();
        assertThrows(IllegalArgumentException.class, () -> service.affecter(4L, new AffectationRequest(2L, TypeAffectation.TEMPORAIRE, null, null)));
        Instant passe = Instant.now().minusSeconds(600);
        assertThrows(IllegalArgumentException.class, () -> service.affecter(4L, new AffectationRequest(2L, TypeAffectation.TEMPORAIRE, passe, passe.minusSeconds(1))));
        assertThrows(IllegalArgumentException.class, () -> service.affecter(4L, new AffectationRequest(2L, TypeAffectation.TEMPORAIRE, passe, passe.plusSeconds(1))));
    }
    @Test void retraitSeulementDuBonLivreur() {
        AffectationZone a = new AffectationZone(); a.setLivreur(livreur()); a.setZone(zone()); a.setType(TypeAffectation.PRINCIPALE);
        when(affectations.findById(10L)).thenReturn(Optional.of(a));
        service.retirer(4L, 10L); verify(affectations).delete(a);
        assertThrows(MarketplaceException.class, () -> service.retirer(99L, 10L));
        assertThrows(MarketplaceException.class, () -> service.retirer(4L, 99L));
    }
}
