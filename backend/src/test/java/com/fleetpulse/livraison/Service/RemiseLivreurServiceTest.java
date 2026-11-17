package com.fleetpulse.livraison.Service;

import static com.fleetpulse.livraison.support.DonneesTest.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.fleetpulse.livraison.Dto.EspaceLivreurDto.RemiseRequest;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.*;
import com.fleetpulse.livraison.Repository.*;
import java.math.BigDecimal;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class RemiseLivreurServiceTest {
    @Mock LivreurRepository livreurs; @Mock LivraisonRepository commandes; @Mock CommandeWorkflow workflow;
    @Mock CodeRemiseService codesRemise; @Mock SecretRemise secret; @InjectMocks RemiseLivreurService service;
    Livraison contexte(StatutLivraison statut) {
        when(livreurs.findByEmail("livreur@test.tn")).thenReturn(Optional.of(livreur()));
        Livraison c = commande(statut); when(commandes.verrouiller(8L)).thenReturn(Optional.of(c)); return c;
    }
    @Test void remiseAvecCodeConfirmeEncaissementEtEffaceLeQr() {
        Livraison c = contexte(StatutLivraison.RECUPEREE); c.setRemiseNonce("ancien");
        when(codesRemise.verifier(8L, "123456")).thenReturn(CodeRemiseService.Resultat.VALIDE);
        service.valider("livreur@test.tn", 8L, new RemiseRequest(new BigDecimal("11.500"), null, "123456"));
        assertEquals(StatutPaiement.ENCAISSE, c.getStatutPaiement()); assertEquals(ModeRemise.CODE, c.getModeRemise());
        assertEquals(new BigDecimal("0.000"), c.getEcartEncaissement()); assertNull(c.getRemiseNonce()); assertNotNull(c.getLivreeLe());
        verify(workflow).transition(eq(c), eq(StatutLivraison.LIVREE), any(), anyString());
    }
    @Test void ecartSansMotifRefuseAvantVerificationDuCode() {
        contexte(StatutLivraison.RECUPEREE);
        assertThrows(IllegalArgumentException.class, () -> service.valider("livreur@test.tn", 8L, new RemiseRequest(BigDecimal.TEN, null, "123456")));
        verifyNoInteractions(codesRemise, workflow);
    }
    @Test void codeIncorrectOuBloqueEtPreuveAbsente() {
        contexte(StatutLivraison.RECUPEREE);
        when(codesRemise.verifier(8L, "123456")).thenReturn(CodeRemiseService.Resultat.INCORRECT, CodeRemiseService.Resultat.BLOQUE);
        var r = new RemiseRequest(new BigDecimal("11.500"), null, "123456");
        assertThrows(IllegalArgumentException.class, () -> service.valider("livreur@test.tn", 8L, r));
        assertThrows(MarketplaceException.class, () -> service.valider("livreur@test.tn", 8L, r));
        assertThrows(IllegalArgumentException.class, () -> service.valider("livreur@test.tn", 8L, new RemiseRequest(new BigDecimal("11.500"), null, "")));
        verifyNoInteractions(workflow);
    }
    @Test void replayEtMauvaisLivreur() {
        Livraison c = contexte(StatutLivraison.LIVREE);
        assertEquals(StatutLivraison.LIVREE, service.valider("livreur@test.tn", 8L, null).statut());
        c.getLivreur().setId(99L); assertThrows(MarketplaceException.class, () -> service.valider("livreur@test.tn", 8L, null));
        verifyNoInteractions(workflow, codesRemise);
    }
    @Test void remiseInterditeAvantCollecte() {
        contexte(StatutLivraison.AFFECTEE);
        assertThrows(MarketplaceException.class, () -> service.valider("livreur@test.tn", 8L, null));
    }
    @Test void remiseManuelleAvecEcartMotive() {
        Livraison c = commande(StatutLivraison.A_PROXIMITE);
        service.validerManuellement(c, livreur(), BigDecimal.TEN, "Monnaie manquante", "Téléphone hors service");
        assertEquals(new BigDecimal("-1.500"), c.getEcartEncaissement()); assertEquals(ModeRemise.MANUELLE, c.getModeRemise());
        c.setStatut(StatutLivraison.PRETE);
        assertThrows(MarketplaceException.class, () -> service.validerManuellement(c, livreur(), BigDecimal.TEN, "Écart", "Motif"));
    }
}
