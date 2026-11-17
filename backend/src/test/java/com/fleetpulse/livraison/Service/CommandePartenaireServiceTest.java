package com.fleetpulse.livraison.Service;

import static com.fleetpulse.livraison.support.DonneesTest.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.fleetpulse.livraison.Dto.CommandePartenaireDto.*;
import com.fleetpulse.livraison.Model.Livraison;
import com.fleetpulse.livraison.Model.enums.*;
import com.fleetpulse.livraison.Repository.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class CommandePartenaireServiceTest {
    @Mock PartenaireRepository partenaires; @Mock LivraisonRepository commandes; @Mock HistoriqueStatutRepository historique;
    @Mock CommandeWorkflow workflow; @Mock DispatchService dispatch; @Mock EstimationLivraisonService estimation;
    @InjectMocks CommandePartenaireService service;
    final String email = "partenaire@test.tn";
    Livraison contexte(StatutLivraison statut) {
        when(partenaires.findByEmail(email)).thenReturn(Optional.of(partenaire()));
        Livraison c = commande(statut); when(commandes.verrouiller(8L)).thenReturn(Optional.of(c)); return c;
    }
    @Test void listeFiltreeEtDetailSansDivulgationAutreCommerce() {
        when(partenaires.findByEmail(email)).thenReturn(Optional.of(partenaire())); Livraison c = commande(StatutLivraison.PRETE);
        when(commandes.findAllByPartenaireIdOrderByDateCreationDesc(3L)).thenReturn(List.of(c));
        assertEquals(8L, service.lister(email, null).getFirst().id());
        when(commandes.findAllByPartenaireIdAndStatutInOrderByDateCreationDesc(3L, List.of(StatutLivraison.PRETE))).thenReturn(List.of(c));
        assertEquals(1, service.lister(email, List.of(StatutLivraison.PRETE)).size());
        when(commandes.findById(8L)).thenReturn(Optional.of(c)); assertEquals("Amal", service.detail(email, 8L).clientPrenom());
        c.getPartenaire().setId(99L); assertThrows(MarketplaceException.class, () -> service.detail(email, 8L));
    }
    @Test void acceptationEnregistreDelaiEtRejeuSansTransition() {
        Livraison c = contexte(StatutLivraison.PENDING_PARTNER);
        java.time.Instant promise = java.time.Instant.parse("2026-11-17T12:30:00Z");
        when(estimation.promesse(eq(c), any())).thenReturn(new EstimationLivraisonService.Promesse(promise, "REGLES"));
        service.accepter(email, 8L, new TempsPreparationRequest(15)); assertEquals(15, c.getTempsPreparationMinutes());
        // US-406 : promesse figee a l'acceptation
        assertEquals(promise, c.getPromesseLivraison()); assertEquals("REGLES", c.getSourcePromesse());
        assertEquals(900, c.getPretePrevueLe().getEpochSecond() - c.getAccepteeLe().getEpochSecond());
        c.setStatut(StatutLivraison.ACCEPTEE); service.accepter(email, 8L, new TempsPreparationRequest(15));
        verify(workflow, times(1)).transition(eq(c), eq(StatutLivraison.ACCEPTEE), any(), anyString());
    }
    @Test void preparationPuisPretGenereEtiquetteEtDeclencheAffectation() {
        Livraison c = contexte(StatutLivraison.ACCEPTEE); service.commencerPreparation(email, 8L);
        assertNotNull(c.getPreparationDebutLe()); service.marquerPrete(email, 8L);
        assertEquals(6, c.getCodeCollecte().length()); verify(dispatch).commandePrete(c);
    }
    @Test void ajustementLimiteADeuxEtInterditApresPret() {
        Livraison c = contexte(StatutLivraison.EN_PREPARATION);
        service.ajusterPreparation(email, 8L, new TempsPreparationRequest(10)); service.ajusterPreparation(email, 8L, new TempsPreparationRequest(20));
        assertEquals(2, c.ajustementsPreparation());
        assertThrows(MarketplaceException.class, () -> service.ajusterPreparation(email, 8L, new TempsPreparationRequest(15)));
        c.setStatut(StatutLivraison.PRETE);
        assertThrows(MarketplaceException.class, () -> service.ajusterPreparation(email, 8L, new TempsPreparationRequest(15)));
    }
    @Test void refusMotiveEtValidationDesParametres() {
        assertThrows(IllegalArgumentException.class, () -> service.accepter(email, 8L, new TempsPreparationRequest(0)));
        assertThrows(IllegalArgumentException.class, () -> service.refuser(email, 8L, new RefusRequest(MotifRefus.AUTRE, null)));
        Livraison c = contexte(StatutLivraison.PENDING_PARTNER);
        service.refuser(email, 8L, new RefusRequest(MotifRefus.AUTRE, " Produit épuisé "));
        assertEquals("Produit épuisé", c.getCommentaireRefus()); assertEquals(MotifRefus.AUTRE, c.getMotifRefus());
    }
    @Test void etiquetteSeulementAvantCollecte() {
        when(partenaires.findByEmail(email)).thenReturn(Optional.of(partenaire()));
        Livraison c = commande(StatutLivraison.PRETE); when(commandes.findById(8L)).thenReturn(Optional.of(c));
        assertEquals("K7Q2MX", service.etiquette(email, 8L).codeCollecte());
        c.setStatut(StatutLivraison.RECUPEREE); assertThrows(MarketplaceException.class, () -> service.etiquette(email, 8L));
    }
}
