package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.EvenementCommande;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

/** Pousse chaque changement de statut au partenaire, au client et au coursier de la commande, une fois la transaction validee. */
@Component @RequiredArgsConstructor
public class DiffusionTempsReel {
    static final String FILE = "/queue/commandes";
    private final SimpMessagingTemplate messages;

    // AFTER_COMMIT : jamais de notification pour une modification annulee ; le client recharge des donnees deja visibles.
    @TransactionalEventListener(fallbackExecution = true)
    public void diffuser(CommandeStatutChange e) {
        EvenementCommande evenement = new EvenementCommande(e.commandeId(), e.ancien(), e.nouveau());
        if (e.partenaireEmail() != null) messages.convertAndSendToUser(e.partenaireEmail(), FILE, evenement);
        messages.convertAndSendToUser(e.clientEmail(), FILE, evenement);
        if (e.livreurEmail() != null) messages.convertAndSendToUser(e.livreurEmail(), FILE, evenement);
    }
}
