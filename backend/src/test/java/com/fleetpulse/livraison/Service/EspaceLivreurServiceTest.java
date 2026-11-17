package com.fleetpulse.livraison.Service;

import static com.fleetpulse.livraison.support.DonneesTest.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.fleetpulse.livraison.Dto.EspaceLivreurDto.*;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.*;
import com.fleetpulse.livraison.Repository.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class EspaceLivreurServiceTest {
    @Mock LivreurRepository livreurs; @Mock AffectationZoneRepository affectations; @Mock LivraisonRepository commandes;
    @Mock ZoneService zones; @Mock AffectationMissionService affectationMissions;
    @Mock CommandeWorkflow workflow; @Mock CodeRemiseService codesRemise; @InjectMocks EspaceLivreurService service;
    final String email = "livreur@test.tn";
    Livreur compte() { Livreur l = livreur(); when(livreurs.findByEmail(email)).thenReturn(Optional.of(l)); return l; }
    AffectationZone autorisation() {
        var a = new AffectationZone(); a.setLivreur(livreur()); a.setZone(zone()); a.setType(TypeAffectation.PRINCIPALE);
        when(affectations.findAllByLivreurIdOrderByTypeAscIdAsc(4L)).thenReturn(List.of(a)); return a;
    }
    @Test void consulterEtSeDeclarerIndisponible() {
        Livreur l = compte(); assertTrue(service.disponibilite(email).disponible());
        assertFalse(service.changerDisponibilite(email, new DisponibiliteRequest(false, null, null)).disponible());
        assertFalse(l.estDisponible()); verifyNoInteractions(affectationMissions);
    }
    @Test void disponibiliteDansZoneDeclencheLesAffectations() {
        compte(); autorisation(); when(zones.trouver(36.8, 10.18)).thenReturn(Optional.of(zone()));
        assertTrue(service.changerDisponibilite(email, new DisponibiliteRequest(true, 36.8, 10.18)).disponible());
        verify(affectationMissions).affecterCommandesEnAttente(any(), eq(List.of(2L)));
    }
    @Test void refuseAbsenceDeZoneEtPositionHorsZone() {
        compte(); var r = new DisponibiliteRequest(true, 36.8, 10.18);
        assertThrows(MarketplaceException.class, () -> service.changerDisponibilite(email, r));
        autorisation(); when(zones.trouver(36.8, 10.18)).thenReturn(Optional.empty());
        assertThrows(MarketplaceException.class, () -> service.changerDisponibilite(email, r)); verifyNoInteractions(affectationMissions);
    }
    @Test void requeteOuCompteAbsents() {
        assertThrows(IllegalArgumentException.class, () -> service.changerDisponibilite(email, null));
        assertThrows(MarketplaceException.class, () -> service.disponibilite(email));
    }
    @Test void missionsDuSeulLivreurConnecte() {
        compte(); Livraison c = commande(StatutLivraison.AFFECTEE);
        when(commandes.findAllByLivreurIdAndStatutInOrderByAffecteeLeAsc(eq(4L), any())).thenReturn(List.of(c));
        assertEquals(8L, service.missions(email).getFirst().id());
        when(commandes.findById(8L)).thenReturn(Optional.of(c));
        assertNull(service.mission(email, 8L).adresseLivraison());
        c.getLivreur().setId(99L); assertThrows(MarketplaceException.class, () -> service.mission(email, 8L));
    }
    @Test void collecteValideEnvoieLeCodeEtLeRejeuNeLeRenvoiePas() {
        compte(); Livraison c = commande(StatutLivraison.AFFECTEE);
        when(commandes.verrouiller(8L)).thenReturn(Optional.of(c));
        service.confirmerCollecte(email, 8L, new CollecteRequest("K7Q2MX"));
        assertNotNull(c.getRecupereeLe()); verify(codesRemise).creerEtEnvoyer(c);
        verify(workflow).transition(eq(c), eq(StatutLivraison.RECUPEREE), any(), anyString());
        c.setStatut(StatutLivraison.RECUPEREE); service.confirmerCollecte(email, 8L, new CollecteRequest("K7Q2MX"));
        verify(codesRemise, times(1)).creerEtEnvoyer(c);
    }
    @Test void mauvaisCodeOuMauvaisEtatNeDeclenchentPasDeCollecte() {
        compte(); Livraison c = commande(StatutLivraison.AFFECTEE); when(commandes.verrouiller(8L)).thenReturn(Optional.of(c));
        assertThrows(IllegalArgumentException.class, () -> service.confirmerCollecte(email, 8L, new CollecteRequest("ZZZZZZ")));
        c.setStatut(StatutLivraison.PRETE);
        assertThrows(MarketplaceException.class, () -> service.confirmerCollecte(email, 8L, new CollecteRequest("K7Q2MX")));
        verifyNoInteractions(codesRemise, workflow);
    }
}
