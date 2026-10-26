package com.fleetpulse.livraison.Service;

/** Passerelle SMS / email, derriere une interface pour pouvoir changer de fournisseur. */
public interface NotificationSender {
    void envoyerSms(String telephone, String message);

    void envoyerEmail(String email, String sujet, String message);
}
