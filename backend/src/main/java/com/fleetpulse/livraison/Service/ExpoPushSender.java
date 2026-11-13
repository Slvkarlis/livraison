package com.fleetpulse.livraison.Service;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Push via le service Expo (https://exp.host/--/api/v2/push/send).
 * Desactive par defaut (app.push.expo.actif=false) : la notification est seulement journalisee,
 * le client la voit quand meme dans l'application (bandeau temps reel et boite de reception).
 */
@Component
public class ExpoPushSender implements PushSender {
    private static final Logger log = LoggerFactory.getLogger(ExpoPushSender.class);
    static final String URL = "https://exp.host/--/api/v2/push/send";
    /** Limite du service Expo par requete. */
    static final int LOT_MAX = 100;

    private final boolean actif;
    private final RestClient http;

    public ExpoPushSender(@Value("${app.push.expo.actif:false}") boolean actif,
                          @Value("${app.push.expo.jeton-acces:}") String jetonAcces) {
        this.actif = actif;
        SimpleClientHttpRequestFactory delais = new SimpleClientHttpRequestFactory();
        delais.setConnectTimeout(Duration.ofSeconds(3));
        delais.setReadTimeout(Duration.ofSeconds(5));   // ne bloque pas longtemps le thread de la requete qui a change le statut
        RestClient.Builder b = RestClient.builder().requestFactory(delais).baseUrl(URL);
        if (!jetonAcces.isBlank()) b.defaultHeader("Authorization", "Bearer " + jetonAcces);   // « enhanced push security » d'Expo
        this.http = b.build();
    }

    @Override
    public List<String> envoyer(List<String> jetons, String titre, String message, Map<String, Object> donnees) {
        if (jetons.isEmpty()) return List.of();
        if (!actif) {
            log.info("[PUSH desactive] {} appareil(s) : {} — {}", jetons.size(), titre, message);
            return List.of();
        }
        List<String> invalides = new ArrayList<>();
        for (int debut = 0; debut < jetons.size(); debut += LOT_MAX) {
            List<String> lot = jetons.subList(debut, Math.min(jetons.size(), debut + LOT_MAX));
            List<Map<String, Object>> messages = lot.stream().map(j -> {
                Map<String, Object> m = new HashMap<>();
                m.put("to", j);
                m.put("title", titre);
                m.put("body", message);
                m.put("data", donnees);
                m.put("sound", "default");
                m.put("channelId", "commandes");   // canal cree par l'application Android
                return m;
            }).toList();
            try {
                Map<?, ?> reponse = http.post().contentType(MediaType.APPLICATION_JSON).accept(MediaType.APPLICATION_JSON)
                        .body(messages).retrieve().body(Map.class);
                invalides.addAll(jetonsInvalides(lot, reponse));
            } catch (RuntimeException e) {
                log.warn("Push Expo impossible : {}", e.getMessage());
            }
        }
        return invalides;
    }

    /** Les tickets sont dans l'ordre des messages ; DeviceNotRegistered : application desinstallee ou jeton perime. */
    static List<String> jetonsInvalides(List<String> lot, Map<?, ?> reponse) {
        List<String> invalides = new ArrayList<>();
        if (reponse == null || !(reponse.get("data") instanceof List<?> tickets)) return invalides;
        for (int i = 0; i < Math.min(lot.size(), tickets.size()); i++) {
            if (tickets.get(i) instanceof Map<?, ?> t && "error".equals(t.get("status"))
                    && t.get("details") instanceof Map<?, ?> d && "DeviceNotRegistered".equals(d.get("error")))
                invalides.add(lot.get(i));
        }
        return invalides;
    }
}
