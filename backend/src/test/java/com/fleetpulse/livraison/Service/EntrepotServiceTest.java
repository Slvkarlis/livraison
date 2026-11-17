package com.fleetpulse.livraison.Service;

import static com.fleetpulse.livraison.support.DonneesTest.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.*;
import com.fleetpulse.livraison.Repository.*;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

/** US-401 : historisation dans l'entrepot et jeux d'entrainement du modele d'ETA. */
@ExtendWith(MockitoExtension.class)
class EntrepotServiceTest {
    @Mock EvenementEntrepotRepository evenements; @Mock LivraisonRepository commandes;
    @Mock PositionLivreurRepository positions; @Mock ZoneRepository zones;
    @InjectMocks EntrepotService service;
    final Instant accepte = Instant.parse("2026-11-17T11:00:00Z");

    Livraison commande() {
        Livraison c = commande(StatutLivraison.PRETE);
        c.setAccepteeLe(accepte); c.setPreteLe(accepte.plusSeconds(12 * 60)); c.setTempsPreparationMinutes(10);
        return c;
    }

    CommandeStatutChange changement(StatutLivraison ancien, StatutLivraison nouveau) {
        return new CommandeStatutChange(8L, 3L, "partenaire@test.tn", 1L, "client@test.tn", null, ancien, nouveau, Role.PARTENAIRE);
    }

    @Test void commandePreteHistoriseStatutEtPreparationReelle() {
        when(commandes.findById(8L)).thenReturn(Optional.of(commande()));
        service.historiser(changement(StatutLivraison.EN_PREPARATION, StatutLivraison.PRETE));
        ArgumentCaptor<EvenementEntrepot> e = ArgumentCaptor.forClass(EvenementEntrepot.class);
        verify(evenements, times(2)).save(e.capture());
        assertEquals(TypeEvenement.STATUT, e.getAllValues().get(0).getType());
        assertEquals("PRETE", e.getAllValues().get(0).getCode());
        assertEquals(2L, e.getAllValues().get(0).getZoneId());
        var preparation = e.getAllValues().get(1);
        assertEquals(TypeEvenement.PREPARATION, preparation.getType());
        assertEquals(12.0, preparation.getValeur());
        assertEquals("ANNONCE_10", preparation.getCode());
    }

    @Test void noteSansChangementEtCommandeAbsenteIgnorees() {
        service.historiser(changement(StatutLivraison.PRETE, StatutLivraison.PRETE));
        service.historiser(changement(StatutLivraison.PRETE, StatutLivraison.AFFECTEE));
        verify(evenements, never()).save(any());
    }

    @Test void uneErreurNeRemontePasAuWorkflow() {
        when(commandes.findById(8L)).thenThrow(new IllegalStateException("base indisponible"));
        assertDoesNotThrow(() -> service.historiser(changement(StatutLivraison.PRETE, StatutLivraison.AFFECTEE)));
    }

    @Test void echantillonEtaDUneCommandeLivree() {
        Livraison c = commande(); c.setStatut(StatutLivraison.LIVREE);
        c.setRecupereeLe(accepte.plusSeconds(15 * 60)); c.setLivreeLe(accepte.plusSeconds(27 * 60));
        when(commandes.findAllByStatutAndLivreeLeGreaterThanEqualOrderByLivreeLeAsc(StatutLivraison.LIVREE, Instant.EPOCH)).thenReturn(List.of(c));
        var jeu = service.jeuEta(null);
        assertEquals(1, jeu.size());
        var e = jeu.getFirst();
        assertEquals(12, e.heure(), "heure de Tunisie");
        assertEquals(2, e.jourSemaine(), "mardi");
        assertEquals(10, e.preparationAnnonceeMin());
        assertEquals(12.0, e.preparationReelleMin());
        assertEquals(3.0, e.attenteCollecteMin());
        assertEquals(12.0, e.trajetReelMin());
        assertEquals(1, e.tailleLot());
        assertTrue(e.distanceKm() > 1 && e.distanceKm() < 2);
        c.setPartenaire(null);
        assertTrue(service.jeuEta(null).isEmpty(), "sans commerce, la commande n'est pas exploitable");
    }

    @Test void lectureDesEvenementsLimitee() {
        when(evenements.findAllByTypeAndDateGreaterThanEqualOrderByDateAscIdAsc(eq(TypeEvenement.OFFRE), eq(Instant.EPOCH), any()))
                .thenReturn(List.of(new EvenementEntrepot(TypeEvenement.OFFRE, accepte, 8L, 4L, 2L, 50L, 1.2, "PROPOSEE", null)));
        var liste = service.evenements(null, TypeEvenement.OFFRE, 99999);
        assertEquals("PROPOSEE", liste.getFirst().code());
        verify(evenements).findAllByTypeAndDateGreaterThanEqualOrderByDateAscIdAsc(eq(TypeEvenement.OFFRE), eq(Instant.EPOCH),
                argThat(l -> l.max() == EntrepotService.LIMITE_MAX));
    }
}
