package com.fleetpulse.livraison.Dto;

import com.fleetpulse.livraison.Model.Notification;
import com.fleetpulse.livraison.Model.enums.StatutLivraison;
import java.time.Instant;
import java.util.List;

/** US-304 : notifications de suivi de commande. */
public final class NotificationDto {
    private NotificationDto() { }

    /** Aussi le message temps reel /user/queue/notifications (bandeau dans l'application). */
    public record NotificationVue(Long id, Long commandeId, StatutLivraison statut, String titre, String message, Instant creeLe, boolean lue) {
        public static NotificationVue from(Notification n) {
            return new NotificationVue(n.getId(), n.getCommandeId(), n.getStatut(), n.getTitre(), n.getMessage(), n.getCreeLe(), n.getLueLe() != null);
        }
    }

    public record BoiteNotifications(long nonLues, List<NotificationVue> notifications) { }

    /** jeton : ExponentPushToken[...] renvoye par expo-notifications. */
    public record AppareilRequest(String jeton) { }
}
