package com.fleetpulse.livraison.Service;

import static com.fleetpulse.livraison.support.DonneesTest.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.fleetpulse.livraison.Model.Livraison;
import com.fleetpulse.livraison.Model.enums.StatutLivraison;
import com.fleetpulse.livraison.Repository.LivraisonRepository;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class RemiseClientServiceTest {
    @Mock LivraisonRepository commandes; @Mock CodeRemiseService codesRemise; @Mock SecretRemise secret;
    @InjectMocks RemiseClientService service;
    @Test void qrRenouveleNonceEtSignatureValide() {
        Livraison c = commande(StatutLivraison.RECUPEREE); when(commandes.verrouiller(8L)).thenReturn(Optional.of(c));
        when(secret.valeur()).thenReturn("secret-de-test-au-moins-trente-deux-caracteres");
        var qr = service.qr("client@test.tn", 8L); String nonce = c.getRemiseNonce();
        assertNotNull(nonce); assertTrue(qr.expireLe().isAfter(Instant.now()));
        service.qr("client@test.tn", 8L); assertNotEquals(nonce, c.getRemiseNonce());
    }
    @Test void renvoiCodeRetourneLaProchaineDate() {
        Livraison c = commande(StatutLivraison.RECUPEREE); when(commandes.verrouiller(8L)).thenReturn(Optional.of(c));
        when(codesRemise.renvoyer(c)).thenReturn(Instant.now().plusSeconds(60));
        assertNotNull(service.renvoyerCode("client@test.tn", 8L)); verify(codesRemise).renvoyer(c);
    }
    @Test void pasDeQrAvantCollecteOuPourAutreClient() {
        Livraison c = commande(StatutLivraison.AFFECTEE); when(commandes.verrouiller(8L)).thenReturn(Optional.of(c));
        assertThrows(MarketplaceException.class, () -> service.qr("client@test.tn", 8L));
        c.setStatut(StatutLivraison.RECUPEREE);
        assertThrows(MarketplaceException.class, () -> service.qr("autre@test.tn", 8L));
        assertThrows(MarketplaceException.class, () -> service.renvoyerCode("client@test.tn", 99L));
        verifyNoInteractions(codesRemise, secret);
    }
}
