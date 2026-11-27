package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.EvenementCommande;
import com.fleetpulse.livraison.Model.enums.StatutLivraison;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

/** Pousse chaque changement de statut au partenaire, au client et au coursier de la commande, une fois la transaction validee. */
@Component @RequiredArgsConstructor
public class DiffusionTempsReel {
    @TransactionalEventListener @org.springframework.core.annotation.Order(10)
    public void actualiserMembresQuartier(QuartierService.GroupeChange e) {
        for (var membre : e.membres()) messages.convertAndSendToUser(membre.email(), FILE,
                new EvenementCommande(membre.commandeId(), membre.statut(), membre.statut()));
    }
    @TransactionalEventListener
    public void diffuserQuartier(NotificationService.InvitationEnvoyee e) {
        messages.convertAndSendToUser(e.email(), "/queue/notifications", e.notification());
        messages.convertAndSendToUser(e.email(), "/queue/quartier", java.util.Map.of("groupeId", e.groupeId()));
    }
    static final String FILE = "/queue/commandes";
    /** US-302 : positions du coursier, pour le client dont le colis est a bord. */
    static final String FILE_POSITIONS = "/queue/positions";
    private final SimpMessagingTemplate messages;

    // AFTER_COMMIT : jamais de notification pour une modification annulee ; le client recharge des donnees deja visibles.
    @TransactionalEventListener(fallbackExecution = true)
    public void diffuser(CommandeStatutChange e) {
        EvenementCommande evenement = new EvenementCommande(e.commandeId(), e.ancien(), e.nouveau());
        if (e.partenaireEmail() != null) messages.convertAndSendToUser(e.partenaireEmail(), FILE, evenement);
        messages.convertAndSendToUser(e.clientEmail(), FILE, evenement);
        if (e.livreurEmail() != null) messages.convertAndSendToUser(e.livreurEmail(), FILE, evenement);
    }

    /**
     * US-405 : une offre de lot attend le coursier. Meme file que les commandes : l'application recharge ses offres
     * et ses missions a chaque message (statut PRETE inchange, aucune notification client).
     */
    @TransactionalEventListener(fallbackExecution = true)
    public void diffuserOffre(DispatchService.OffreProposee e) {
        messages.convertAndSendToUser(e.livreurEmail(), FILE,
                new EvenementCommande(e.commandeId(), StatutLivraison.PRETE, StatutLivraison.PRETE));
    }

    @TransactionalEventListener(fallbackExecution = true)
    public void diffuserPosition(SuiviPositionService.PositionDiffusee e) {
        messages.convertAndSendToUser(e.clientEmail(), FILE_POSITIONS, e.position());
    }
}
