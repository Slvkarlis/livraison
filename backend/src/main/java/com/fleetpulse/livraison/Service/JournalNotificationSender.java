package com.fleetpulse.livraison.Service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import com.fleetpulse.livraison.Config.ModeDemonstration;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/**
 * Implementation de developpement : les messages (codes OTP compris) sont ecrits dans les logs du serveur.
 * A remplacer par une vraie passerelle SMS / SMTP avant la mise en production.
 */
@Component
public class JournalNotificationSender implements NotificationSender {
    private static final Logger log = LoggerFactory.getLogger(JournalNotificationSender.class);
    private final ModeDemonstration demonstration;
    public JournalNotificationSender(ModeDemonstration demonstration) { this.demonstration = demonstration; }
    @Override
    public void verifierDisponible() {
        if (!demonstration.estActif()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "Service SMS/email non configuré. Utilisez le profil de démonstration en développement.");
    }

    @Override
    public void envoyerSms(String telephone, String message) {
        verifierDisponible();
        log.info("[SMS -> {}] {}", telephone, message);
    }

    @Override
    public void envoyerEmail(String email, String sujet, String message) {
        verifierDisponible();
        log.info("[EMAIL -> {}] {} : {}", email, sujet, message);
    }
}
