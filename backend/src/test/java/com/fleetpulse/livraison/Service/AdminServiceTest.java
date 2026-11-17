package com.fleetpulse.livraison.Service;

import static com.fleetpulse.livraison.support.DonneesTest.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.fleetpulse.livraison.Dto.*;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.*;
import com.fleetpulse.livraison.Repository.*;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;

/** TP 5 : CRUD des véhicules, puis règles de gestion de la flotte. Aucune base de données. */
@ExtendWith(MockitoExtension.class)
class AdminServiceTest {
    @Mock LivreurRepository livreurRepository;
    @Mock VehiculeRepository vehiculeRepository;
    @Mock UtilisateurRepository utilisateurRepository;
    @Mock PasswordEncoder passwordEncoder;
    @Mock JetonRafraichissementService jetonService;
    @Mock AuditService auditService;
    @Mock AffectationZoneRepository affectationRepository;
    @InjectMocks AdminService service;

    final CreateVehiculeRequest creation = new CreateVehiculeRequest(" 123 tu 456 ", "Scooter", 30., 3.);

    @Test void creerVehiculeNormaliseEtEnregistreLesDonnees() {
        when(vehiculeRepository.saveAndFlush(any())).thenAnswer(i -> { Vehicule v = i.getArgument(0); v.setId(5L); return v; });
        var resultat = service.createVehicule(creation);
        assertEquals(5L, resultat.id()); assertEquals("123 TU 456", resultat.immatriculation());
        assertEquals(3., resultat.consommationLitres100Km());
        verify(vehiculeRepository).saveAndFlush(argThat(v -> v.getCapaciteKg().equals(30.)));
        verify(auditService).enregistrer(ActionAudit.VEHICULE_CREE, "VEHICULE", 5L, "123 TU 456");
    }

    @Test void listeVideEtListeRemplie() {
        when(vehiculeRepository.findAllByOrderByImmatriculationAsc()).thenReturn(List.of(), List.of(vehicule()));
        assertTrue(service.listVehicules().isEmpty());
        assertEquals("123 TU 456", service.listVehicules().getFirst().immatriculation());
    }

    @Test void lectureParIdTrouveOuAbsent() {
        when(vehiculeRepository.findById(5L)).thenReturn(Optional.of(vehicule()));
        when(vehiculeRepository.findById(99L)).thenReturn(Optional.empty());
        assertEquals(5L, service.findVehicule(5L).orElseThrow().id());
        assertTrue(service.findVehicule(99L).isEmpty());
    }

    @Test void modificationRechercheModifieEtSauvegarde() {
        Vehicule v = vehicule(); when(vehiculeRepository.findById(5L)).thenReturn(Optional.of(v));
        when(vehiculeRepository.save(v)).thenReturn(v);
        var resultat = service.updateVehicule(5L, new CreateVehiculeRequest(" 456 tu 789 ", "Voiture", 100., 6.)).orElseThrow();
        assertEquals("456 TU 789", resultat.immatriculation()); assertEquals("Voiture", v.getType());
        assertEquals(100., v.getCapaciteKg()); assertEquals(6., v.getConsommationLitres100Km());
        verify(vehiculeRepository).save(v);
    }

    @Test void modificationAbsenteNeSauvegardeRien() {
        when(vehiculeRepository.findById(99L)).thenReturn(Optional.empty());
        assertTrue(service.updateVehicule(99L, creation).isEmpty()); verify(vehiculeRepository, never()).save(any());
    }

    @Test void suppressionLogiqueEtReactivationConserventLeVehicule() {
        Vehicule v = vehicule(); when(vehiculeRepository.findById(5L)).thenReturn(Optional.of(v));
        assertTrue(service.deactivateVehicule(5L)); assertFalse(v.isActif());
        assertTrue(service.activateVehicule(5L)); assertTrue(v.isActif());
        verify(vehiculeRepository, times(2)).save(v); verify(vehiculeRepository, never()).delete(any());
    }

    @Test void suppressionOuActivationAbsente() {
        assertFalse(service.deactivateVehicule(99L)); assertFalse(service.activateVehicule(99L));
        verify(vehiculeRepository, never()).save(any());
    }

    @Test void creationInvalideEtDoublon() {
        assertThrows(IllegalArgumentException.class, () -> service.createVehicule(null));
        assertThrows(IllegalArgumentException.class, () -> service.createVehicule(new CreateVehiculeRequest(" ", null, null, null)));
        for (double valeur : new double[]{Double.NaN, 1, 31})
            assertThrows(IllegalArgumentException.class, () -> service.createVehicule(new CreateVehiculeRequest("AA", null, null, valeur)));
        when(vehiculeRepository.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException("unique"));
        assertThrows(AdminService.DuplicateDataException.class, () -> service.createVehicule(creation));
    }

    @Test void listeLivreursAvecLeurZonePrincipale() {
        var a = new AffectationZone(); a.setLivreur(livreur()); a.setZone(zone());
        when(affectationRepository.findAllByType(TypeAffectation.PRINCIPALE)).thenReturn(List.of(a));
        when(livreurRepository.findAllByStatutInOrderByNomAscPrenomAsc(any())).thenReturn(List.of(livreur()));
        assertEquals("Tunis", service.listLivreurs().getFirst().zonePrincipale());
    }

    @Test void creationLivreurValideEncodeLeMotDePasseEtAudite() {
        when(passwordEncoder.encode("mot-de-passe")).thenReturn("hash");
        var r = service.createLivreur(new CreateLivreurRequest(" Nom ", " Sami ", " LIVREUR@TEST.TN ", "mot-de-passe", "20123456"));
        assertEquals("livreur@test.tn", r.email()); assertEquals("Sami", r.prenom());
        verify(livreurRepository).saveAndFlush(argThat(l -> l.getMotDePasseHash().equals("hash") && l.getRole() == Role.LIVREUR));
    }

    @Test void livreurInvalideOuEmailDuplique() {
        assertThrows(IllegalArgumentException.class, () -> service.createLivreur(null));
        when(utilisateurRepository.existsByEmail("livreur@test.tn")).thenReturn(true);
        assertThrows(AdminService.DuplicateDataException.class, () -> service.createLivreur(
                new CreateLivreurRequest("Nom", "Sami", "livreur@test.tn", "mot-de-passe", null)));
        verifyNoInteractions(livreurRepository);
    }

    @Test void modificationEtSuspensionLivreur() {
        Livreur l = livreur(); when(livreurRepository.findById(4L)).thenReturn(Optional.of(l));
        when(livreurRepository.save(l)).thenReturn(l); when(passwordEncoder.encode("nouveau-mdp")).thenReturn("nouveau-hash");
        assertEquals("Autre", service.updateLivreur(4L, new CreateLivreurRequest("Autre", "Ali", null, "nouveau-mdp", "20222222")).orElseThrow().nom());
        assertTrue(service.deactivateLivreur(4L)); assertEquals(StatutCompte.SUSPENDU, l.getStatut());
        verify(jetonService).revoquerTous(l);
        assertTrue(service.activateLivreur(4L)); assertNull(l.getMotifStatut());
    }

    @Test void livreurAbsentOuCandidatNePeutEtreActiveCommeFlotte() {
        assertTrue(service.updateLivreur(99L, new CreateLivreurRequest(null, null, null, null, null)).isEmpty());
        assertFalse(service.deactivateLivreur(99L)); assertFalse(service.activateLivreur(99L));
        Livreur l = livreur(); l.setStatut(StatutCompte.EN_ATTENTE);
        when(livreurRepository.findById(4L)).thenReturn(Optional.of(l)); assertFalse(service.activateLivreur(4L));
    }

    @Test void affectationEtRetraitVehicule() {
        Livreur l = livreur(); Vehicule v = vehicule();
        when(livreurRepository.findById(4L)).thenReturn(Optional.of(l));
        when(vehiculeRepository.findById(5L)).thenReturn(Optional.of(v)); when(livreurRepository.save(l)).thenReturn(l);
        assertEquals(5L, service.assignVehicule(4L, new AssignVehiculeRequest(5L)).orElseThrow().vehiculeId());
        assertSame(v, l.getVehicule()); assertTrue(service.unassignVehicule(4L)); assertNull(l.getVehicule());
        assertFalse(service.unassignVehicule(99L));
    }

    @Test void affectationRefuseVehiculeInactifOuAbsentEtRequeteVide() {
        assertThrows(IllegalArgumentException.class, () -> service.assignVehicule(4L, null));
        assertTrue(service.assignVehicule(4L, new AssignVehiculeRequest(99L)).isEmpty());
        Vehicule v = vehicule(); v.setActif(false);
        when(livreurRepository.findById(4L)).thenReturn(Optional.of(livreur()));
        when(vehiculeRepository.findById(5L)).thenReturn(Optional.of(v));
        assertTrue(service.assignVehicule(4L, new AssignVehiculeRequest(5L)).isEmpty());
    }
    @Test void reaffectationLibereLeVehiculeDuLivreurPrecedent() {
        Livreur ancien=livreur(); ancien.setId(10L); Livreur nouveau=livreur(); Vehicule v=vehicule();
        ancien.setVehicule(v); v.setLivreur(ancien);
        when(livreurRepository.findById(4L)).thenReturn(Optional.of(nouveau));
        when(vehiculeRepository.findById(5L)).thenReturn(Optional.of(v)); when(livreurRepository.save(nouveau)).thenReturn(nouveau);
        service.assignVehicule(4L,new AssignVehiculeRequest(5L));
        assertNull(ancien.getVehicule()); assertSame(v,nouveau.getVehicule()); verify(livreurRepository).saveAndFlush(ancien);
    }
}
