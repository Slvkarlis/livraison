package com.fleetpulse.livraison.Service;

import static com.fleetpulse.livraison.support.DonneesTest.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.fleetpulse.livraison.Model.Livraison;
import com.fleetpulse.livraison.Model.enums.StatutLivraison;
import com.fleetpulse.livraison.Repository.LivraisonRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class SuiviCommandeServiceTest {
    @Mock LivraisonRepository commandes; @InjectMocks SuiviCommandeService service;
    @Test void livreurCacheAvantCollectePuisVisibleAvecEta() {
        Livraison c = commande(StatutLivraison.AFFECTEE); when(commandes.findById(8L)).thenReturn(Optional.of(c));
        assertNull(service.suivi("client@test.tn", 8L).livreur());
        c.setStatut(StatutLivraison.RECUPEREE);
        var vue = service.suivi("client@test.tn", 8L);
        assertNotNull(vue.livreur()); assertEquals(36.8, vue.livreur().latitude()); assertNotNull(vue.arriveeEstimee());
        assertEquals(36.81, vue.destination().latitude());
    }
    @Test void commandeTermineeOuHistoriqueSansCommerce() {
        Livraison c = commande(StatutLivraison.LIVREE); when(commandes.findById(8L)).thenReturn(Optional.of(c));
        assertNull(service.suivi("client@test.tn", 8L).arriveeEstimee());
        c.setPartenaire(null); assertNull(service.suivi("client@test.tn", 8L).commerce());
    }
    @Test void autreClientEtCommandeAbsente() {
        when(commandes.findById(8L)).thenReturn(Optional.of(commande(StatutLivraison.PRETE)));
        assertThrows(MarketplaceException.class, () -> service.suivi("autre@test.tn", 8L));
        assertThrows(MarketplaceException.class, () -> service.suivi("client@test.tn", 99L));
    }
}
