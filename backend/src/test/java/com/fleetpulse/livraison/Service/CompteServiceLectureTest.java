package com.fleetpulse.livraison.Service;

import static com.fleetpulse.livraison.support.DonneesTest.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.fleetpulse.livraison.Dto.*;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.*;
import com.fleetpulse.livraison.Repository.UtilisateurRepository;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class CompteServiceLectureTest {
    @Mock UtilisateurRepository utilisateurRepository; @Mock PasswordEncoder passwordEncoder;
    @Mock JetonRafraichissementService jetonService; @Mock AuditService auditService;
    @Mock NotificationSender notificationSender; @InjectMocks CompteService service;
    @Test void listeFiltreeParRoleEtStatut() {
        Livreur l=livreur(); l.setStatut(StatutCompte.SUSPENDU);
        when(utilisateurRepository.findAllByOrderByNomAscPrenomAsc()).thenReturn(List.of(client(),l));
        assertEquals(2,service.lister(null,null).size()); assertEquals(1,service.lister(Role.CLIENT,StatutCompte.ACTIF).size());
        assertTrue(service.lister(Role.LIVREUR,StatutCompte.ACTIF).isEmpty());
    }
    @Test void dossiersEnAttenteEtConsultationDuTitulaire() {
        Partenaire p=partenaire(); p.setStatut(StatutCompte.EN_ATTENTE);
        when(utilisateurRepository.findAllByStatutInOrderByDateCreationAsc(any())).thenReturn(List.of(p));
        when(utilisateurRepository.findById(3L)).thenReturn(Optional.of(p));
        when(utilisateurRepository.findByEmail(p.getEmail())).thenReturn(Optional.of(p));
        assertEquals(StatutCompte.EN_ATTENTE,service.dossiersOuverts().getFirst().statut());
        assertEquals(3L,service.detail(3L).id()); assertEquals(3L,service.monDossier(p.getEmail()).id());
        assertThrows(CompteService.CompteIntrouvableException.class,()->service.detail(99L));
        assertThrows(CompteService.CompteIntrouvableException.class,()->service.monDossier("absent"));
    }
    @Test void correctionPartenaireNormaliseEtResoumetLeDossier() {
        Partenaire p=partenaire(); p.setStatut(StatutCompte.COMPLEMENT_DEMANDE);
        when(utilisateurRepository.findByEmail(p.getEmail())).thenReturn(Optional.of(p));
        var r=new DossierRequest(" Nom "," Prénom ","+21620123456"," Nouveau commerce "," Restaurant "," Rue de Tunis ",36.8,10.18," MF-123 ",null,null);
        var vue=service.corrigerDossier(p.getEmail(),r);
        assertEquals("Nouveau commerce",vue.nomCommerce()); assertEquals("MF-123",vue.matriculeFiscal());
        assertEquals(StatutCompte.EN_ATTENTE,vue.statut()); assertFalse(p.isTelephoneVerifie());
    }
    @Test void identiteDisponibiliteEtRemplissageValidentsLesDonnees() {
        assertEquals("client@test.tn",service.verifierIdentite(" Nom "," Prénom "," CLIENT@TEST.TN ","test-password"));
        assertThrows(IllegalArgumentException.class,()->service.verifierIdentite("","Prénom","x","court"));
        assertThrows(IllegalArgumentException.class,()->service.verifierIdentite("Nom","Prénom","client@test.tn","court"));
        when(utilisateurRepository.existsByEmail("existant@test.tn")).thenReturn(true);
        assertThrows(CompteService.DonneeDejaUtiliseeException.class,()->service.verifierDisponibilite("existant@test.tn",null));
        when(utilisateurRepository.existsByTelephone("+21620123456")).thenReturn(true);
        assertThrows(CompteService.DonneeDejaUtiliseeException.class,()->service.verifierDisponibilite("autre@test.tn","+21620123456"));
        service.verifierDisponibilite("libre@test.tn",null);
        when(passwordEncoder.encode("test-password")).thenReturn("hash"); Client c=new Client();
        service.remplirIdentite(c," Nom "," Prénom ","client@test.tn",null,"test-password");
        assertEquals("Nom",c.getNom()); assertEquals("hash",c.getMotDePasseHash());
    }
    @Test void dossiersIncompletsEtCoordonneesInvalidesRefuses() {
        Partenaire p=partenaire(); p.setTelephone("+21620123456"); p.setMatriculeFiscal("MF-123");
        assertDoesNotThrow(()->service.verifierDossier(p)); p.setLatitude(91.);
        assertThrows(IllegalArgumentException.class,()->service.verifierDossier(p)); p.setLatitude(36.8); p.setNomCommerce(" ");
        assertThrows(IllegalArgumentException.class,()->service.verifierDossier(p));
        Livreur l=livreur(); l.setTelephone("+21620123456");
        assertThrows(IllegalArgumentException.class,()->service.verifierDossier(l)); l.setNumeroIdentite("12345678");l.setVehiculeDeclare("Scooter");
        assertDoesNotThrow(()->service.verifierDossier(l)); l.setTelephone("invalide"); assertThrows(IllegalArgumentException.class,()->service.verifierDossier(l));
    }
}
