package com.fleetpulse.livraison.Service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Implementation de developpement : les messages (codes OTP compris) sont ecrits dans les logs du serveur.
 * A remplacer par une vraie passerelle SMS / SMTP avant la mise en production.
 */
@Component
public class JournalNotificationSender implements NotificationSender {
    private static final Logger log = LoggerFactory.getLogger(JournalNotificationSender.class);

    @Override
    public void envoyerSms(String telephone, String message) {
        log.info("[SMS -> {}] {}", telephone, message);
    }

    @Override
    public void envoyerEmail(String email, String sujet, String message) {
        log.info("[EMAIL -> {}] {} : {}", email, sujet, message);
    }
}
