package com.fleetpulse.livraison.Service;

import static com.fleetpulse.livraison.support.DonneesTest.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.fleetpulse.livraison.Dto.GestionCommandeDto.*;
import com.fleetpulse.livraison.Model.Livraison;
import com.fleetpulse.livraison.Model.enums.StatutLivraison;
import com.fleetpulse.livraison.Repository.*;
import java.math.BigDecimal;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class GestionCommandeServiceTest {
    @Mock LivraisonRepository commandes; @Mock HistoriqueStatutRepository historique; @Mock UtilisateurRepository utilisateurs;
    @Mock CommandeWorkflow workflow; @Mock CodeRemiseService codesRemise; @Mock RemiseLivreurService remise; @Mock AuditService audit;
    @InjectMocks GestionCommandeService service;
    Livraison contexte(StatutLivraison statut) {
        Livraison c = commande(statut); when(commandes.verrouiller(8L)).thenReturn(Optional.of(c));
        when(utilisateurs.findByEmail("admin@test.tn")).thenReturn(Optional.of(livreur())); return c;
    }
    @Test void suiviListeLesActionsSelonLeStatutEtRefuseAbsence() {
        when(commandes.findById(8L)).thenReturn(Optional.of(commande(StatutLivraison.AFFECTEE)));
        assertTrue(service.suivi(8L).actions().contains(ActionResponsable.VALIDER_COLLECTE));
        assertThrows(MarketplaceException.class, () -> service.suivi(99L));
    }
    @Test void annulationAuditeeEtQrInvalide() {
        Livraison c = contexte(StatutLivraison.RECUPEREE); c.setRemiseNonce("ancien");
        service.annuler("admin@test.tn", 8L, new MotifRequest(" Client indisponible "));
        assertTrue(c.getAnnuleeParService()); assertNull(c.getRemiseNonce()); assertNotNull(c.getAnnuleeLe());
        verify(audit).enregistrer(any(), eq("COMMANDE"), eq(8L), contains("Client indisponible"));
    }
    @Test void collecteManuelleDeclencheCodeEtAudit() {
        Livraison c = contexte(StatutLivraison.AFFECTEE);
        service.validerCollecte("admin@test.tn", 8L, new MotifRequest("Étiquette abîmée"));
        assertNotNull(c.getRecupereeLe()); verify(codesRemise).creerEtEnvoyer(c);
        verify(workflow).transition(eq(c), eq(StatutLivraison.RECUPEREE), any(), contains("Étiquette abîmée"));
    }
    @Test void remiseDelegueLeMontantEtLeMotifPuisAudite() {
        Livraison c = contexte(StatutLivraison.RECUPEREE);
        doAnswer(i -> { c.setMontantEncaisse(new BigDecimal("11.500")); c.setEcartEncaissement(BigDecimal.ZERO); return null; })
                .when(remise).validerManuellement(eq(c), any(), any(), isNull(), anyString());
        service.validerRemise("admin@test.tn", 8L, new RemiseManuelleRequest("Téléphone hors service", new BigDecimal("11.500"), null));
        verify(audit).enregistrer(any(), eq("COMMANDE"), eq(8L), contains("11.500"));
    }
    @Test void motifObligatoireEtCommandesTermineesRefusees() {
        assertThrows(IllegalArgumentException.class, () -> service.annuler("admin", 8L, null));
        assertThrows(IllegalArgumentException.class, () -> service.validerRemise("admin", 8L, null));
        when(commandes.verrouiller(8L)).thenReturn(Optional.of(commande(StatutLivraison.LIVREE)));
        assertThrows(MarketplaceException.class, () -> service.annuler("admin", 8L, new MotifRequest("Motif valide")));
        assertThrows(MarketplaceException.class, () -> service.validerCollecte("admin", 8L, new MotifRequest("Motif valide")));
        verifyNoInteractions(workflow, codesRemise);
    }
}
