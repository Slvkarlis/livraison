package com.fleetpulse.livraison.Service;

import static com.fleetpulse.livraison.support.DonneesTest.*;
import static org.junit.jupiter.api.Assertions.*;
import com.fleetpulse.livraison.Model.Livraison;
import com.fleetpulse.livraison.Model.enums.*;
import java.util.EnumSet;
import org.junit.jupiter.api.Test;

class MessagesStatutTest {
    @Test void chaqueEtapeDuParcoursPossedeUnMessageAvecLaReference() {
        Livraison c=commande(StatutLivraison.ACCEPTEE);
        for(var statut:EnumSet.of(StatutLivraison.ACCEPTEE,StatutLivraison.EN_PREPARATION,StatutLivraison.PRETE,StatutLivraison.AFFECTEE,
                StatutLivraison.RECUPEREE,StatutLivraison.A_PROXIMITE,StatutLivraison.LIVREE,StatutLivraison.REFUSEE,StatutLivraison.ANNULEE)) {
            var message=MessagesStatut.pourClient(c,statut).orElseThrow();
            assertTrue(message.titre().contains(c.getCodeSuivi())); assertFalse(message.texte().isBlank());
        }
        assertTrue(MessagesStatut.pourClient(c,StatutLivraison.PENDING_PARTNER).isEmpty());
    }
    @Test void libellesDeRepliEtMotifsRestentLisibles() {
        Livraison c=commande(StatutLivraison.ACCEPTEE); c.setPartenaire(null); c.setLivreur(null); c.setAccepteeLe(null);
        assertTrue(MessagesStatut.pourClient(c,StatutLivraison.ACCEPTEE).orElseThrow().texte().contains("Le commerce"));
        assertTrue(MessagesStatut.pourClient(c,StatutLivraison.EN_PREPARATION).orElseThrow().texte().contains("prépare"));
        for(var s:EnumSet.of(StatutLivraison.AFFECTEE,StatutLivraison.RECUPEREE,StatutLivraison.A_PROXIMITE))
            assertTrue(MessagesStatut.pourClient(c,s).isPresent());
        c.setMotifRefus(MotifRefus.AUTRE);c.setCommentaireRefus("Stock épuisé");c.setMotifAnnulation("Client absent");
        assertTrue(MessagesStatut.pourClient(c,StatutLivraison.REFUSEE).orElseThrow().texte().contains("Stock épuisé"));
        assertTrue(MessagesStatut.pourClient(c,StatutLivraison.ANNULEE).orElseThrow().texte().contains("Client absent"));
    }
}
