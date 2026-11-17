package com.fleetpulse.livraison.Service;

import static com.fleetpulse.livraison.support.DonneesTest.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.fleetpulse.livraison.Dto.MarketplaceDto.*;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Repository.*;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ZoneServiceMetierTest {
    @Mock ZoneRepository zones; @Mock PartenaireRepository partenaires; @Mock AffectationZoneRepository affectations;
    @Mock AuditService audit; @Mock EntityManager entityManager; @InjectMocks ZoneService service;
    ZoneRequest requete(String nom) {
        return new ZoneRequest(nom, List.of(new Position(36.,10.),new Position(36.,11.),new Position(37.,11.),new Position(37.,10.)), new BigDecimal("3.500"), 25.);
    }
    @Test void rechercheDansPolygoneEtHorsCouverture() {
        when(zones.candidates(36.8, 10.18)).thenReturn(List.of(zone()));
        assertEquals(2L, service.trouver(36.8, 10.18).orElseThrow().getId());
        assertEquals("Tunis", service.desservie(36.8, 10.18).getNom());
        assertThrows(IllegalArgumentException.class, () -> service.desservie(0, 0));
    }
    @Test void listeInclutLeNombreDePartenaires() {
        when(zones.findAllByOrderByIdAsc()).thenReturn(List.of(zone())); when(partenaires.findAll()).thenReturn(List.of(partenaire()));
        assertEquals(1, service.lister().getFirst().partenaires());
    }
    @Test void voisinageSymetriqueParFrontiereEtPasParSommetIsole() {
        Zone a = zone();
        Zone b = new Zone(); b.setId(3L); b.setNom("Est"); b.setFraisLivraison(BigDecimal.ONE);
        b.definirPolygone(ZoneService.polygone(List.of(new Position(36.,11.),new Position(36.,12.),new Position(37.,12.),new Position(37.,11.))));
        Zone coin = new Zone(); coin.setId(4L); coin.setNom("Coin"); coin.setFraisLivraison(BigDecimal.ONE);
        coin.definirPolygone(ZoneService.polygone(List.of(new Position(37.,11.),new Position(37.,12.),new Position(38.,12.),new Position(38.,11.))));
        when(zones.findAllByOrderByIdAsc()).thenReturn(List.of(a,b,coin));
        var vues=service.lister();
        assertEquals(List.of(3L),vues.get(0).voisines().stream().map(ZoneVoisine::id).toList());
        assertTrue(vues.get(1).voisines().stream().anyMatch(v -> v.id().equals(2L)));
    }
    @Test void creationEtModificationDuTarif() {
        when(zones.saveAndFlush(any())).thenAnswer(i -> { Zone z = i.getArgument(0); z.setId(2L); return z; });
        assertEquals("Nouvelle", service.enregistrer(null, requete(" Nouvelle ")).nom());
        Zone z = zone(); when(zones.findById(2L)).thenReturn(Optional.of(z));
        var r = requete("Modifiée"); service.enregistrer(2L, new ZoneRequest(r.nom(), r.polygone(), new BigDecimal("4.000"), null));
        assertEquals(new BigDecimal("4.000"), z.getFraisLivraison());
        verify(audit).enregistrer(eq(com.fleetpulse.livraison.Model.enums.ActionAudit.FRAIS_ZONE_MODIFIES), eq("ZONE"), eq(2L), anyString());
    }
    @Test void refusChevauchementEtZoneAbsente() {
        when(zones.findAllByOrderByIdAsc()).thenReturn(List.of(zone()));
        assertThrows(IllegalArgumentException.class, () -> service.enregistrer(null, requete("Doublon")));
        assertThrows(MarketplaceException.class, () -> service.enregistrer(2L, requete("Absente")));
    }
    @Test void rattachementFermeUnCommerceHorsZone() {
        Partenaire p = partenaire(); service.rattacher(p); assertNull(p.getZone()); assertFalse(p.getOuvert());
        when(zones.candidates(36.8, 10.18)).thenReturn(List.of(zone())); service.rattacher(p);
        assertEquals(2L, p.getZone().getId()); assertFalse(p.getOuvert());
    }
    @Test void suppressionRefuseLesReferencesPuisSupprimeSansReference() {
        Zone z = zone(); when(zones.findById(2L)).thenReturn(Optional.of(z));
        when(partenaires.findAll()).thenReturn(List.of(partenaire()), List.of(), List.of());
        assertThrows(MarketplaceException.class, () -> service.supprimer(2L));
        when(affectations.existsByZoneId(2L)).thenReturn(true, false);
        assertThrows(MarketplaceException.class, () -> service.supprimer(2L));
        service.supprimer(2L); verify(zones).delete(z);
        assertThrows(MarketplaceException.class, () -> service.supprimer(99L));
    }
}
