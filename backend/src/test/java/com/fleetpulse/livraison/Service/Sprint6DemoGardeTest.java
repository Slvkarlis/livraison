package com.fleetpulse.livraison.Service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.fleetpulse.livraison.Config.ModeDemonstration;
import com.fleetpulse.livraison.Repository.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class Sprint6DemoGardeTest {
    @Mock ModeDemonstration mode; @Mock UtilisateurRepository utilisateurs; @Mock ZoneRepository zones;
    @Mock ProduitRepository produits; @Mock LivraisonRepository commandes; @Mock AffectationZoneRepository affectations;
    @Mock PasswordEncoder encoder; @Mock ComptabiliteService comptabilite; @Mock CaisseService caisses;
    @Mock ClosingService closings; @Mock NotationService notations;
    @InjectMocks Sprint6DemoInitializer demo;
    @Test void aucunSeedSansFlagEtAucunSeedEnProductionMemeAvecFlags() {
        demo.initialiser(); verifyNoInteractions(utilisateurs, commandes);
        var env = new MockEnvironment(); env.setActiveProfiles("demo", "production");
        assertFalse(new ModeDemonstration(true, env).estActif());
        ReflectionTestUtils.setField(demo, "donnees", true);
        when(mode.estActif()).thenReturn(false);
        demo.initialiser(); verifyNoInteractions(utilisateurs, zones, produits, commandes, affectations, encoder, comptabilite, caisses, closings, notations);
    }
}
