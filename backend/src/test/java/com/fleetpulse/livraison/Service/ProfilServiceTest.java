package com.fleetpulse.livraison.Service;

import static com.fleetpulse.livraison.support.DonneesTest.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.fleetpulse.livraison.Model.Livreur;
import com.fleetpulse.livraison.Model.enums.Role;
import com.fleetpulse.livraison.Repository.UtilisateurRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ProfilServiceTest {
    @Mock UtilisateurRepository utilisateurRepository; @InjectMocks ProfilService service;
    @Test void profilContientLeRoleEtLeVehiculeSansMotDePasse() {
        Livreur l = livreur(); l.setVehicule(vehicule()); l.setMotDePasseHash("secret");
        when(utilisateurRepository.findByEmail(l.getEmail())).thenReturn(Optional.of(l));
        var p = service.findByEmail(l.getEmail()).orElseThrow();
        assertEquals(Role.LIVREUR, p.role()); assertEquals("123 TU 456", p.vehicule().immatriculation());
    }
    @Test void compteIntrouvable() { assertTrue(service.findByEmail("absent@test.tn").isEmpty()); }
}
