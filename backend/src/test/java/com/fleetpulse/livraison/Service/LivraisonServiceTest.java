package com.fleetpulse.livraison.Service;

import static com.fleetpulse.livraison.support.DonneesTest.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.fleetpulse.livraison.Model.enums.StatutLivraison;
import com.fleetpulse.livraison.Repository.LivraisonRepository;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class LivraisonServiceTest {
    @Mock LivraisonRepository livraisonRepository; @InjectMocks LivraisonService service;
    @Test void listeGlobaleVidePuisEnrichie() {
        when(livraisonRepository.findAllByOrderByDateCreationDesc()).thenReturn(List.of(), List.of(commande(StatutLivraison.PRETE)));
        assertTrue(service.listAll().isEmpty()); assertEquals("Chez Amira", service.listAll().getFirst().nomPartenaire());
    }
    @Test void listeClientNeDemandeQueSesCommandes() {
        when(livraisonRepository.findAllByClientEmailOrderByDateCreationDesc("client@test.tn")).thenReturn(List.of(commande(StatutLivraison.LIVREE)));
        assertEquals(StatutLivraison.LIVREE, service.listForClient("client@test.tn").getFirst().statut());
        verify(livraisonRepository, never()).findAllByOrderByDateCreationDesc();
        assertTrue(service.listForClient("autre@test.tn").isEmpty());
    }
}
