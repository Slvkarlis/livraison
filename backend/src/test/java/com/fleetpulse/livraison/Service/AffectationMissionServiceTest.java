package com.fleetpulse.livraison.Service;

import static com.fleetpulse.livraison.support.DonneesTest.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.*;
import com.fleetpulse.livraison.Repository.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AffectationMissionServiceTest {
    @Mock AffectationZoneRepository affectations; @Mock LivraisonRepository commandes;
    @Mock CommandeWorkflow workflow; @InjectMocks AffectationMissionService service;
    AffectationZone candidat(long id, TypeAffectation type, boolean disponible) {
        var a = new AffectationZone(); Livreur l = livreur(); l.setId(id); l.setDisponible(disponible);
        a.setLivreur(l); a.setZone(zone()); a.setType(type); return a;
    }
    @Test void prioriteZonePrincipalePuisMoinsCharge() {
        Livraison c = commande(StatutLivraison.PRETE); c.setLivreur(null);
        var principal = candidat(4, TypeAffectation.PRINCIPALE, true);
        var secondaire = candidat(5, TypeAffectation.SECONDAIRE, true);
        when(affectations.findAllByZoneId(2L)).thenReturn(List.of(secondaire, principal));
        when(commandes.countByLivreurIdAndStatutIn(anyLong(), any())).thenAnswer(i -> i.getArgument(0).equals(4L) ? 2L : 0L);
        service.affecterSiPossible(c); assertEquals(4L, c.getLivreur().getId()); assertNotNull(c.getAffecteeLe());
        verify(workflow).transition(eq(c), eq(StatutLivraison.AFFECTEE), eq(principal.getLivreur()), anyString());
    }
    @Test void commandeAttendSiTousIndisponiblesOuSatures() {
        Livraison c = commande(StatutLivraison.PRETE); c.setLivreur(null);
        when(affectations.findAllByZoneId(2L)).thenReturn(List.of(candidat(4, TypeAffectation.PRINCIPALE, false), candidat(5, TypeAffectation.PRINCIPALE, true)));
        when(commandes.countByLivreurIdAndStatutIn(eq(5L), any())).thenReturn(3L);
        service.affecterSiPossible(c); assertNull(c.getLivreur()); verifyNoInteractions(workflow);
    }
    @Test void aucunEffetSiDejaAffecteeOuPasPrete() {
        service.affecterSiPossible(commande(StatutLivraison.AFFECTEE));
        Livraison c = commande(StatutLivraison.ACCEPTEE); c.setLivreur(null); service.affecterSiPossible(c);
        c.setStatut(StatutLivraison.PRETE); c.setPartenaire(null); service.affecterSiPossible(c);
        verifyNoInteractions(affectations, commandes, workflow);
    }
    @Test void disponibiliteReprendLesCommandesEnAttenteSansDepasserLaLimite() {
        Livreur l = livreur(); Livraison c = commande(StatutLivraison.PRETE); c.setLivreur(null);
        when(commandes.findAllByStatutAndLivreurIsNullAndPartenaireZoneIdInOrderByPreteLeAsc(StatutLivraison.PRETE, List.of(2L))).thenReturn(List.of(c));
        when(commandes.verrouiller(8L)).thenReturn(Optional.of(c));
        service.affecterCommandesEnAttente(l, List.of(2L)); assertSame(l, c.getLivreur());
        when(commandes.countByLivreurIdAndStatutIn(eq(4L), any())).thenReturn(3L);
        service.affecterCommandesEnAttente(l, List.of(2L)); verify(commandes, times(1)).verrouiller(8L);
    }
}
