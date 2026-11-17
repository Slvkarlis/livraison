package com.fleetpulse.livraison.Service;

import static com.fleetpulse.livraison.support.DonneesTest.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.StatutLivraison;
import com.fleetpulse.livraison.Repository.CodeRemiseRepository;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@ExtendWith(MockitoExtension.class)
class CodeRemiseServiceTest {
    @Mock CodeRemiseRepository codes; @Mock PasswordEncoder encodeur; @Mock NotificationSender notifications;
    @InjectMocks CodeRemiseService service;
    @AfterEach void nettoyer() { if (TransactionSynchronizationManager.isSynchronizationActive()) TransactionSynchronizationManager.clearSynchronization(); }
    @Test void codeHacheEtEnvoyeSeulementApresValidationDeTransaction() {
        when(encodeur.encode(anyString())).thenReturn("hash-secret");
        TransactionSynchronizationManager.initSynchronization();
        service.creerEtEnvoyer(commande(StatutLivraison.RECUPEREE));
        verify(codes).save(argThat(c -> c.getCodeHash().equals("hash-secret") && c.getNbEnvois() == 1));
        verifyNoInteractions(notifications);
        TransactionSynchronizationManager.getSynchronizations().forEach(s -> s.afterCommit());
        verify(notifications).envoyerSms(eq("+21620123456"), contains("FP-TEST-0001"));
    }
    @Test void sansTelephoneLeCodePartParEmail() {
        when(encodeur.encode(anyString())).thenReturn("hash");
        Livraison c = commande(StatutLivraison.RECUPEREE); c.getClient().setTelephone(null);
        service.creerEtEnvoyer(c);
        verify(notifications).envoyerEmail(eq("client@test.tn"), anyString(), anyString());
    }
    @Test void renvoiLimiteEnNombreEtEnFrequence() {
        Livraison c = commande(StatutLivraison.RECUPEREE); CodeRemise code = new CodeRemise(); code.setNbEnvois(4);
        when(codes.findByCommandeId(8L)).thenReturn(Optional.of(code));
        assertThrows(MarketplaceException.class, () -> service.renvoyer(c));
        code.setNbEnvois(1); code.setDernierEnvoiLe(Instant.now());
        assertThrows(MarketplaceException.class, () -> service.renvoyer(c));
        code.setDernierEnvoiLe(Instant.now().minusSeconds(120)); when(encodeur.encode(anyString())).thenReturn("hash");
        assertNotNull(service.renvoyer(c)); assertEquals(2, code.getNbEnvois());
    }
    @Test void essaisIncorrectsComptesPuisBlocageEtCodeValide() {
        assertEquals(CodeRemiseService.Resultat.BLOQUE, service.verifier(99L, "123456"));
        CodeRemise c = new CodeRemise(); c.setCodeHash("hash"); c.setTentatives(3);
        when(codes.findByCommandeId(8L)).thenReturn(Optional.of(c));
        assertEquals(CodeRemiseService.Resultat.INCORRECT, service.verifier(8L, "123456"));
        assertEquals(CodeRemiseService.Resultat.BLOQUE, service.verifier(8L, "123456"));
        assertEquals(5, c.getTentatives()); c.setTentatives(0);
        when(encodeur.matches("123456", "hash")).thenReturn(true);
        assertEquals(CodeRemiseService.Resultat.VALIDE, service.verifier(8L, "123 456"));
    }
}
