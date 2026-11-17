package com.fleetpulse.livraison.Service;

import static com.fleetpulse.livraison.support.DonneesTest.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.fleetpulse.livraison.Dto.MarketplaceDto.AdresseRequest;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Repository.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AdresseServiceTest {
    @Mock ClientRepository clients; @Mock AdresseLivraisonRepository adresses; @Mock CatalogueService catalogue;
    @InjectMocks AdresseService service;
    final String email = "client@test.tn";
    final AdresseRequest requete = new AdresseRequest(" Maison ", " Rue de Tunis ", 36.81, 10.19);

    @Test void listeVidePuisAdressesDuClient() {
        when(adresses.findAllByClientEmailOrderByIdAsc(email)).thenReturn(List.of(), List.of(adresse()));
        assertTrue(service.lister(email).isEmpty()); assertEquals("Maison", service.lister(email).getFirst().libelle());
    }
    @Test void creationEtModificationNormalisentLesChamps() {
        when(clients.verrouiller(email)).thenReturn(Optional.of(client()));
        when(adresses.save(any())).thenAnswer(i -> { AdresseLivraison a = i.getArgument(0); a.setId(7L); return a; });
        assertEquals("Rue de Tunis", service.enregistrer(email, null, requete).adresse());
        AdresseLivraison a = adresse(); when(catalogue.adresse(email, 7L)).thenReturn(a);
        assertEquals(7L, service.enregistrer(email, 7L, requete).id()); verify(adresses).save(a);
    }
    @Test void limiteEtCoordonneesInvalidesNeSauvegardentRien() {
        when(clients.verrouiller(email)).thenReturn(Optional.of(client()));
        when(adresses.countByClientId(1L)).thenReturn(20L);
        assertThrows(MarketplaceException.class, () -> service.enregistrer(email, null, requete));
        assertThrows(IllegalArgumentException.class, () -> service.enregistrer(email, null, null));
        assertThrows(IllegalArgumentException.class, () -> service.enregistrer(email, null, new AdresseRequest("A", "B", 91., 10.)));
        verify(adresses, never()).save(any());
    }
    @Test void clientEtAdresseIntrouvables() {
        assertThrows(MarketplaceException.class, () -> service.enregistrer(email, null, requete));
        when(clients.verrouiller(email)).thenReturn(Optional.of(client()));
        when(catalogue.adresse(email, 99L)).thenThrow(MarketplaceException.absent());
        assertThrows(MarketplaceException.class, () -> service.enregistrer(email, 99L, requete));
    }
    @Test void suppressionRespecteLeProprietaire() {
        when(clients.verrouiller(email)).thenReturn(Optional.of(client()));
        AdresseLivraison a = adresse(); when(catalogue.adresse(email, 7L)).thenReturn(a);
        service.supprimer(email, 7L); verify(adresses).delete(a);
        when(catalogue.adresse(email, 99L)).thenThrow(MarketplaceException.absent());
        assertThrows(MarketplaceException.class, () -> service.supprimer(email, 99L));
        verify(adresses, times(1)).delete(any());
    }
}
