package com.fleetpulse.livraison.Service;

import java.util.List;
import java.util.Map;

/** US-304 : envoi d'une notification push aux telephones d'un utilisateur. */
public interface PushSender {
    /** Renvoie les jetons que le service de push declare invalides (application desinstallee) : a oublier. */
    List<String> envoyer(List<String> jetons, String titre, String message, Map<String, Object> donnees);
}
