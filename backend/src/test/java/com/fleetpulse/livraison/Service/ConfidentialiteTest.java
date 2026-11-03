package com.fleetpulse.livraison.Service;

import static org.junit.jupiter.api.Assertions.*;
import com.fleetpulse.livraison.Config.ModeDemonstration;
import com.fleetpulse.livraison.Dto.*;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

class ConfidentialiteTest {
    @Test
    void lesRepresentationsDesDtoNeContiennentAucunSecret() throws Exception {
        for (Class<?> type : new Class<?>[] { LoginRequest.class, LoginResponse.class, RefreshRequest.class,
                SignupRequest.class, InscriptionTelephoneRequest.class, InscriptionPartenaireRequest.class,
                CandidatureLivreurRequest.class, ReinitialisationRequest.class, CreateResponsableRequest.class,
                CreateLivreurRequest.class }) {
            var constructeur = type.getDeclaredConstructors()[0];
            Class<?>[] types = constructeur.getParameterTypes();
            Object[] arguments = new Object[types.length];
            for (int i = 0; i < types.length; i++) {
                arguments[i] = types[i] == String.class ? "secret-a-ne-jamais-journaliser"
                        : types[i] == long.class ? 42L : null;
            }
            assertEquals(type.getSimpleName() + "[confidentiel]", constructeur.newInstance(arguments).toString());
        }
    }

    @Test
    void lesLogsDeCodesExigentLeFlagEtUnProfilDeDeveloppement() {
        var env = new MockEnvironment();
        assertFalse(new ModeDemonstration(true, env).estActif());
        env.setActiveProfiles("prod");
        assertFalse(new ModeDemonstration(true, env).estActif());
        env.setActiveProfiles("demo");
        assertFalse(new ModeDemonstration(false, env).estActif());
        assertTrue(new ModeDemonstration(true, env).estActif());
        env.setActiveProfiles("dev");
        assertTrue(new ModeDemonstration(true, env).estActif());
        env.setActiveProfiles("demo", "prod");
        assertFalse(new ModeDemonstration(true, env).estActif());
    }
}
