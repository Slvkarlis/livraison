package com.fleetpulse.livraison.Service;

import static com.fleetpulse.livraison.support.DonneesTest.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.*;
import com.fleetpulse.livraison.Repository.LivraisonRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

/** US-406 : promesse figee a l'acceptation (IA ou regles) et ETA actualisee le long du lot. */
@ExtendWith(MockitoExtension.class)
class EstimationLivraisonServiceTest {
    @Mock LivraisonRepository commandes; @Mock ServiceIa ia;
    EstimationLivraisonService service;
    final Instant maintenant = Instant.parse("2026-11-17T11:02:30Z");

    @BeforeEach void preparer() { service = new EstimationLivraisonService(commandes, ia); }

    @Test void promesseParReglesArrondieAuxCinqMinutes() {
        Livraison c = commande(StatutLivraison.ACCEPTEE);   // 10 min annoncees, client a ~1,4 km
        var promesse = service.promesse(c, maintenant);
        assertEquals("REGLES", promesse.source());
        // 10 min de preparation + 2 min de collecte + ~5,5 min de trajet + 5 min de marge, arrondi
        long minutes = Duration.between(maintenant, promesse.heure()).toMinutes();
        assertTrue(minutes >= 22 && minutes <= 28, "minutes : " + minutes);
        assertEquals(0, promesse.heure().getEpochSecond() % 300);
    }

    @Test void promesseParIaQuandLeServiceRepond() {
        when(ia.predireEta(any())).thenReturn(Optional.of(new ServiceIa.PredictionEta(20, 10, "gbr")));
        var promesse = service.promesse(commande(StatutLivraison.ACCEPTEE), maintenant);
        assertEquals("IA", promesse.source());
        // 20 + 2 + 10 = 32 min, marge 5 min : 37 min, arrondi a 11:40
        assertEquals(Instant.parse("2026-11-17T11:40:00Z"), promesse.heure());
        ArgumentCaptor<ServiceIa.CaracteristiquesEta> c = ArgumentCaptor.forClass(ServiceIa.CaracteristiquesEta.class);
        verify(ia).predireEta(c.capture());
        assertEquals(10, c.getValue().preparationAnnonceeMin());
        assertEquals(12, c.getValue().heure(), "heure de Tunisie (UTC+1)");
    }

    @Test void ponctualiteApprisePuisBornee() {
        assertEquals(1, service.ponctualite(partenaire()));   // pas d'historique
        when(commandes.findTop20ByPartenaireIdAndPreteLeIsNotNullAndAccepteeLeIsNotNullOrderByPreteLeDesc(3L))
                .thenReturn(List.of(historique(10, 12), historique(10, 14)));
        assertEquals(1.3, service.ponctualite(partenaire()), 1e-9);
        when(commandes.findTop20ByPartenaireIdAndPreteLeIsNotNullAndAccepteeLeIsNotNullOrderByPreteLeDesc(3L))
                .thenReturn(List.of(historique(10, 40)));
        assertEquals(EstimationLivraisonService.RATIO_MAX, service.ponctualite(partenaire()));
    }

    @Test void preparationPreditePlusLongueQueLAnnonce() {
        Livraison c = commande(StatutLivraison.EN_PREPARATION); c.setPreteLe(null); c.setAccepteeLe(maintenant);
        c.setPretePrevueLe(maintenant.plusSeconds(600));
        when(commandes.findTop20ByPartenaireIdAndPreteLeIsNotNullAndAccepteeLeIsNotNullOrderByPreteLeDesc(3L))
                .thenReturn(List.of(historique(10, 15)));
        assertEquals(maintenant.plusSeconds(900), service.finDePreparation(c));
    }

    @Test void etaLeLongDeLItineraireDuLot() {
        Lot lot = new Lot(); lot.setId(50L); lot.setStatut(StatutLot.ACCEPTE);
        Livraison proche = commande(StatutLivraison.RECUPEREE); proche.setLot(lot);
        Livraison loin = commande(StatutLivraison.RECUPEREE); loin.setId(9L); loin.setLot(lot);
        loin.setLivreur(proche.getLivreur()); loin.setLatitude(36.85); loin.setLongitude(10.19);
        when(commandes.findAllByLotIdOrderByIdAsc(50L)).thenReturn(List.of(proche, loin));
        Instant etaProche = service.arrivee(proche, maintenant), etaLoin = service.arrivee(loin, maintenant);
        assertTrue(etaProche.isBefore(etaLoin), "le client le plus proche est livre en premier");
        assertTrue(etaLoin.isAfter(maintenant.plus(Duration.ofMinutes(10))));
    }

    @Test void sansLotOuCommandeTermineeReglesDuSprint3() {
        assertNotNull(service.arrivee(commande(StatutLivraison.RECUPEREE), maintenant));
        assertNull(service.arrivee(commande(StatutLivraison.LIVREE), maintenant));
        Livraison sansCommerce = commande(StatutLivraison.RECUPEREE); sansCommerce.setPartenaire(null);
        assertNull(service.arrivee(sansCommerce, maintenant));
        assertEquals(Instant.parse("2026-11-17T11:05:00Z"), EstimationLivraisonService.arrondir5(Instant.parse("2026-11-17T11:00:01Z")));
        assertEquals(Instant.parse("2026-11-17T11:05:00Z"), EstimationLivraisonService.arrondir5(Instant.parse("2026-11-17T11:05:00Z")));
    }

    Livraison historique(int annonce, int reel) {
        Livraison l = commande(StatutLivraison.LIVREE); l.setTempsPreparationMinutes(annonce);
        l.setAccepteeLe(maintenant.minusSeconds(3600)); l.setPreteLe(maintenant.minusSeconds(3600 - reel * 60L)); return l;
    }
}
