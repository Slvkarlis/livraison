package com.fleetpulse.livraison.Service;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fleetpulse.livraison.Model.Client;
import com.fleetpulse.livraison.Model.JetonRafraichissement;
import com.fleetpulse.livraison.Repository.JetonRafraichissementRepository;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.test.util.ReflectionTestUtils;

class JetonRafraichissementServiceTest {
    private final JetonRafraichissementRepository repository = mock(JetonRafraichissementRepository.class);
    private final JetonRafraichissementService service = new JetonRafraichissementService();
    private final Map<String, JetonRafraichissement> parHash = new HashMap<>();
    private final Client client = new Client();

    @BeforeEach
    void configurer() {
        ReflectionTestUtils.setField(service, "repository", repository);
        ReflectionTestUtils.setField(service, "dureeMs", 60_000L);
        when(repository.save(any())).thenAnswer(invocation -> {
            JetonRafraichissement jeton = invocation.getArgument(0);
            parHash.put(jeton.getJetonHash(), jeton);
            return jeton;
        });
        when(repository.findByJetonHash(anyString()))
                .thenAnswer(invocation -> Optional.ofNullable(parHash.get(invocation.<String>getArgument(0))));
    }

    @Test
    void seulLeHashEstStockeEtLeJetonSertUneSeuleFois() {
        String jeton = service.emettre(client);

        assertTrue(parHash.keySet().stream().noneMatch(jeton::equals));
        assertSame(client, service.consommer(jeton));
        // Rejeu d'un jeton deja utilise : vol probable, toutes les sessions sont revoquees
        assertThrows(BadCredentialsException.class, () -> service.consommer(jeton));
        verify(repository).revoquerTous(client);
    }

    @Test
    void jetonExpireOuInconnuRefuse() {
        String jeton = service.emettre(client);
        parHash.values().forEach(entite -> entite.setExpireLe(Instant.now().minusSeconds(1)));

        assertThrows(BadCredentialsException.class, () -> service.consommer(jeton));
        assertThrows(BadCredentialsException.class, () -> service.consommer("inconnu"));
        assertThrows(BadCredentialsException.class, () -> service.consommer(null));
    }

    @Test
    void deconnexionRevoqueLeJeton() {
        String jeton = service.emettre(client);
        service.revoquer(jeton);
        assertThrows(BadCredentialsException.class, () -> service.consommer(jeton));
    }
}
