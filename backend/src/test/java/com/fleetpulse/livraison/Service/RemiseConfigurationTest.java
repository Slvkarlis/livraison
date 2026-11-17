package com.fleetpulse.livraison.Service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.fleetpulse.livraison.Config.ModeDemonstration;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class RemiseConfigurationTest {
    @Test void secretHmacObligatoireEtAssezLong() {
        assertThrows(IllegalStateException.class,()->new SecretRemise(null));
        assertThrows(IllegalStateException.class,()->new SecretRemise("court"));
        assertEquals("x".repeat(32),new SecretRemise("x".repeat(32)).valeur());
    }
    @Test void passerelleDemoRefuseDeSimulerUnEnvoiHorsDemonstration() {
        ModeDemonstration demo=mock(ModeDemonstration.class); var sender=new JournalNotificationSender(demo);
        assertEquals(503,assertThrows(ResponseStatusException.class,sender::verifierDisponible).getStatusCode().value());
        when(demo.estActif()).thenReturn(true);
        assertDoesNotThrow(()->sender.envoyerSms("+21620123456","Code de démonstration"));
        assertDoesNotThrow(()->sender.envoyerEmail("client@test.tn","Remise","Code de démonstration"));
    }
}
