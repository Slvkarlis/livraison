package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.NotificationDto.*;
import com.fleetpulse.livraison.Model.AppareilNotification;
import com.fleetpulse.livraison.Model.Livraison;
import com.fleetpulse.livraison.Model.Notification;
import com.fleetpulse.livraison.Model.Utilisateur;
import com.fleetpulse.livraison.Repository.AppareilNotificationRepository;
import com.fleetpulse.livraison.Repository.LivraisonRepository;
import com.fleetpulse.livraison.Repository.NotificationRepository;
import com.fleetpulse.livraison.Repository.UtilisateurRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * US-304 : le client est notifie a chaque changement de statut de sa commande :
 * ligne dans sa boite de reception, bandeau temps reel (/user/queue/notifications) et push sur ses telephones.
 */
@Service @RequiredArgsConstructor @Transactional
public class NotificationService {
    @org.springframework.beans.factory.annotation.Autowired private org.springframework.context.ApplicationEventPublisher evenements;
    public record InvitationEnvoyee(String email, Long groupeId, NotificationVue notification, List<String> jetons) { }

    /** Persistée avec le quota ; diffusion et push seulement après le commit. */
    public void inviterQuartier(Utilisateur client, Long groupeId, String texte) {
        Notification n = notifications.save(new Notification(client, null, null, "Livraison de quartier", texte,
                Instant.now().truncatedTo(ChronoUnit.MICROS)));
        evenements.publishEvent(new InvitationEnvoyee(client.getEmail(), groupeId, NotificationVue.from(n),
                appareils.findAllByUtilisateurId(client.getId()).stream().map(AppareilNotification::getJeton).toList()));
    }

    @TransactionalEventListener
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void pousserQuartier(InvitationEnvoyee e) {
        try {
            for (String invalide : push.envoyer(e.jetons(), e.notification().titre(), e.notification().message(), Map.of("groupeQuartierId", e.groupeId())))
                appareils.findByJeton(invalide).ifPresent(appareils::delete);
        } catch (RuntimeException ex) { log.warn("Push quartier indisponible : {}", ex.getClass().getSimpleName()); }
    }
    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);
    static final String FILE = "/queue/notifications";
    static final int TAILLE_BOITE = 50;
    private static final Pattern JETON_EXPO = Pattern.compile("^Expo(nent)?PushToken\\[[A-Za-z0-9_-]{10,180}]$");

    private final NotificationRepository notifications;
    private final AppareilNotificationRepository appareils;
    private final UtilisateurRepository utilisateurs;
    private final LivraisonRepository commandes;
    private final SimpMessagingTemplate messages;
    private final PushSender push;

    /**
     * Apres validation : aucune notification pour un changement annule.
     * Transaction a part : un echec de notification n'annule jamais le changement de statut, deja enregistre.
     */
    @TransactionalEventListener(fallbackExecution = true)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifier(CommandeStatutChange e) {
        if (e.ancien() == e.nouveau()) return;   // simple note dans l'historique (ex. delai ajuste)
        if (e.acteurRole() == com.fleetpulse.livraison.Model.enums.Role.CLIENT) return;   // le client sait ce qu'il vient de faire
        try {
            Livraison c = commandes.findById(e.commandeId()).orElse(null);
            if (c == null) return;
            MessagesStatut.pourClient(c, e.nouveau()).ifPresent(m -> envoyer(c.getClient(), c.getId(), e.nouveau(), m));
        } catch (RuntimeException ex) {
            log.warn("Notification de la commande {} impossible : {}", e.commandeId(), ex.getMessage());
        }
    }

    private void envoyer(Utilisateur destinataire, Long commandeId, com.fleetpulse.livraison.Model.enums.StatutLivraison statut,
                         MessagesStatut.Message m) {
        Notification n = notifications.save(new Notification(destinataire, commandeId, statut, m.titre(), m.texte(),
                Instant.now().truncatedTo(ChronoUnit.MICROS)));
        messages.convertAndSendToUser(destinataire.getEmail(), FILE, NotificationVue.from(n));
        List<String> jetons = appareils.findAllByUtilisateurId(destinataire.getId()).stream().map(AppareilNotification::getJeton).toList();
        for (String invalide : push.envoyer(jetons, m.titre(), m.texte(), Map.of("commandeId", commandeId)))
            appareils.findByJeton(invalide).ifPresent(appareils::delete);
    }

    @Transactional(readOnly = true)
    public BoiteNotifications boite(String email) {
        Utilisateur u = utilisateur(email);
        return new BoiteNotifications(notifications.countByDestinataireIdAndLueLeIsNull(u.getId()),
                notifications.findAllByDestinataireIdOrderByCreeLeDescIdDesc(u.getId(), PageRequest.of(0, TAILLE_BOITE))
                        .stream().map(NotificationVue::from).toList());
    }

    public void marquerLues(String email) {
        notifications.marquerLues(utilisateur(email).getId(), Instant.now().truncatedTo(ChronoUnit.MICROS));
    }

    /** Un telephone partage passe au dernier compte connecte : l'ancien compte n'y recoit plus rien. */
    public void enregistrerAppareil(String email, AppareilRequest r) {
        String jeton = jeton(r);
        Utilisateur u = utilisateur(email);
        AppareilNotification a = appareils.findByJeton(jeton).orElseGet(AppareilNotification::new);
        a.setJeton(jeton);
        a.setUtilisateur(u);
        a.setMajLe(Instant.now().truncatedTo(ChronoUnit.MICROS));
        appareils.save(a);
    }

    /** A la deconnexion ; sans effet si le jeton appartient a un autre compte. */
    public void retirerAppareil(String email, AppareilRequest r) {
        Utilisateur u = utilisateur(email);
        appareils.findByJeton(jeton(r)).filter(a -> a.getUtilisateur().getId().equals(u.getId())).ifPresent(appareils::delete);
    }

    private static String jeton(AppareilRequest r) {
        String jeton = r == null || r.jeton() == null ? "" : r.jeton().trim();
        if (!JETON_EXPO.matcher(jeton).matches()) throw new IllegalArgumentException("Jeton de notification invalide.");
        return jeton;
    }

    private Utilisateur utilisateur(String email) {
        return utilisateurs.findByEmail(email).orElseThrow(MarketplaceException::absent);
    }
}
