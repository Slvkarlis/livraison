package com.fleetpulse.livraison.Service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fleetpulse.livraison.Model.Livreur;
import com.fleetpulse.livraison.Model.Partenaire;
import com.fleetpulse.livraison.Model.Responsable;
import com.fleetpulse.livraison.Model.Utilisateur;
import com.fleetpulse.livraison.Model.enums.ActionAudit;
import com.fleetpulse.livraison.Model.enums.Role;
import com.fleetpulse.livraison.Model.enums.StatutCompte;
import com.fleetpulse.livraison.Repository.UtilisateurRepository;
import com.fleetpulse.livraison.Service.CompteService.TransitionInvalideException;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.util.ReflectionTestUtils;

class CompteServiceTest {
    private final UtilisateurRepository repository = mock(UtilisateurRepository.class);
    private final JetonRafraichissementService jetons = mock(JetonRafraichissementService.class);
    private final AuditService audit = mock(AuditService.class);
    private final CompteService service = new CompteService();
    private final Authentication operations = auteur("ops@test.tn", "ROLE_RESPONSABLE", "ROLE_OPERATIONS");
    private final Authentication admin = auteur("admin@test.tn", "ROLE_RESPONSABLE", "ROLE_ADMIN", "ROLE_OPERATIONS");

    @BeforeEach
    void configurer() {
        ReflectionTestUtils.setField(service, "utilisateurRepository", repository);
        ReflectionTestUtils.setField(service, "jetonService", jetons);
        ReflectionTestUtils.setField(service, "auditService", audit);
        ReflectionTestUtils.setField(service, "notificationSender", mock(NotificationSender.class));
    }

    private static Authentication auteur(String email, String... roles) {
        return new UsernamePasswordAuthenticationToken(email, null,
                List.of(roles).stream().map(SimpleGrantedAuthority::new).toList());
    }

    private <T extends Utilisateur> T compte(T utilisateur, Role role, StatutCompte statut) {
        utilisateur.setId(5L);
        utilisateur.setEmail("compte@test.tn");
        utilisateur.setRole(role);
        utilisateur.setStatut(statut);
        when(repository.findById(5L)).thenReturn(Optional.of(utilisateur));
        return utilisateur;
    }

    @Test
    void validerUnDossierEnAttenteActiveLeCompte() {
        Partenaire partenaire = compte(new Partenaire(), Role.PARTENAIRE, StatutCompte.EN_ATTENTE);

        assertEquals(StatutCompte.ACTIF, service.valider(5L).statut());
        assertEquals(StatutCompte.ACTIF, partenaire.getStatut());
        verify(audit).enregistrer(ActionAudit.COMPTE_VALIDE, partenaire, null);
    }

    @Test
    void refuserExigeUnMotifEtLeConserve() {
        Livreur livreur = compte(new Livreur(), Role.LIVREUR, StatutCompte.EN_ATTENTE);

        assertThrows(IllegalArgumentException.class, () -> service.refuser(5L, "  "));
        service.refuser(5L, "Permis expiré");

        assertEquals(StatutCompte.REFUSE, livreur.getStatut());
        assertEquals("Permis expiré", livreur.getMotifStatut());
        verify(jetons).revoquerTous(livreur);
    }

    @Test
    void complementPuisCorrectionRemetLeDossierEnAttente() {
        Livreur livreur = compte(new Livreur(), Role.LIVREUR, StatutCompte.EN_ATTENTE);
        livreur.setTelephone("22123456");
        livreur.setNumeroIdentite("01234567");
        when(repository.findByEmail("compte@test.tn")).thenReturn(Optional.of(livreur));

        service.demanderComplement(5L, "Photo du véhicule manquante");
        assertEquals(StatutCompte.COMPLEMENT_DEMANDE, livreur.getStatut());

        service.corrigerDossier("compte@test.tn", new com.fleetpulse.livraison.Dto.DossierRequest(
                null, null, null, null, null, null, null, null, null, null, "Scooter 125 TU-1234"));
        assertEquals(StatutCompte.EN_ATTENTE, livreur.getStatut());
        assertNull(livreur.getMotifStatut());
        assertEquals("Scooter 125 TU-1234", livreur.getVehiculeDeclare());
    }

    @Test
    void unDossierIncompletNePeutPasEtreResoumis() {
        Livreur livreur = compte(new Livreur(), Role.LIVREUR, StatutCompte.COMPLEMENT_DEMANDE);
        livreur.setTelephone("22123456");
        when(repository.findByEmail("compte@test.tn")).thenReturn(Optional.of(livreur));

        assertThrows(IllegalArgumentException.class, () -> service.corrigerDossier("compte@test.tn",
                new com.fleetpulse.livraison.Dto.DossierRequest(
                        null, null, null, null, null, null, null, null, null, null, null)));
        assertEquals(StatutCompte.COMPLEMENT_DEMANDE, livreur.getStatut());
    }

    @Test
    void unCompteActifNePeutPasEtreValideDeNouveau() {
        compte(new Partenaire(), Role.PARTENAIRE, StatutCompte.ACTIF);
        assertThrows(TransitionInvalideException.class, () -> service.valider(5L));
    }

    @Test
    void suspendreRevoqueLesSessionsEtTraceLeMotif() {
        Livreur livreur = compte(new Livreur(), Role.LIVREUR, StatutCompte.ACTIF);

        service.suspendre(5L, "Cash non déposé", operations);

        assertEquals(StatutCompte.SUSPENDU, livreur.getStatut());
        verify(jetons).revoquerTous(livreur);
        verify(audit).enregistrer(ActionAudit.COMPTE_SUSPENDU, livreur, "Cash non déposé");
    }

    @Test
    void reactiverExigeUnCompteSuspenduEtUnMotif() {
        Livreur livreur = compte(new Livreur(), Role.LIVREUR, StatutCompte.SUSPENDU);

        assertThrows(IllegalArgumentException.class, () -> service.reactiver(5L, null, operations));
        service.reactiver(5L, "Dépôt régularisé", operations);

        assertEquals(StatutCompte.ACTIF, livreur.getStatut());
        verify(audit).enregistrer(ActionAudit.COMPTE_REACTIVE, livreur, "Dépôt régularisé");
    }

    @Test
    void onNePeutPasSeSuspendreSoiMeme() {
        Responsable moi = compte(new Responsable(), Role.RESPONSABLE, StatutCompte.ACTIF);
        moi.setEmail("admin@test.tn");
        assertThrows(TransitionInvalideException.class, () -> service.suspendre(5L, "Test", admin));
    }

    @Test
    void seulLAdministrateurPrincipalSuspendUnResponsable() {
        compte(new Responsable(), Role.RESPONSABLE, StatutCompte.ACTIF);

        assertThrows(AccessDeniedException.class, () -> service.suspendre(5L, "Départ", operations));
        assertEquals(StatutCompte.SUSPENDU, service.suspendre(5L, "Départ", admin).statut());
    }

    @Test
    void creerUnResponsableExigeUnSousRole() {
        assertThrows(IllegalArgumentException.class, () -> service.creerResponsable(
                new com.fleetpulse.livraison.Dto.CreateResponsableRequest(
                        "Ben Ali", "Sami", "finance@test.tn", null, "motdepasse1", null)));
        verify(repository, never()).save(any());
        verify(audit, never()).enregistrer(eq(ActionAudit.RESPONSABLE_CREE), any(Utilisateur.class), anyString());
    }
}
