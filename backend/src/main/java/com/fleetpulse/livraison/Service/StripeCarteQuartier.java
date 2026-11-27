package com.fleetpulse.livraison.Service;

import java.math.*;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.*;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Checkout hébergé avec autorisation ; seule la somme finale est capturée après fermeture du groupe. */
@Service
public class StripeCarteQuartier implements PasserelleCarteQuartier {
    @Value("${app.stripe.secret-key:}") private String secret;
    @Value("${app.stripe.retour-url:http://localhost:8081/commande/}") private String retour;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private final JsonMapper json = JsonMapper.builder().build();
    public boolean active() { return secret != null && !secret.isBlank(); }
    public Session ouvrir(Long commandeId, BigDecimal montant) {
        long millimes = millimes(montant);
        String url = retour + commandeId;
        JsonNode n = appel("POST", "/checkout/sessions", Map.of("mode", "payment", "success_url", url, "cancel_url", url,
                "payment_method_types[0]", "card", "payment_intent_data[capture_method]", "manual",
                "client_reference_id", commandeId.toString(), "line_items[0][price_data][currency]", "tnd",
                "line_items[0][price_data][unit_amount]", Long.toString(millimes),
                "line_items[0][price_data][product_data][name]", "Commande FleetPulse", "line_items[0][quantity]", "1"), "quartier-session-" + commandeId);
        return new Session(n.path("id").asText(), n.path("url").asText());
    }
    public Autorisation verifier(String sessionId) {
        JsonNode session = appel("GET", "/checkout/sessions/" + identifiant(sessionId) + "?expand[]=payment_intent", Map.of(), null);
        JsonNode p = session.path("payment_intent");
        return new Autorisation(p.path("id").asText(""), p.path("status").asText("en_attente"),
                BigDecimal.valueOf(session.path("amount_total").asLong(0), 3), session.path("currency").asText(""),
                BigDecimal.valueOf(p.path("amount_received").asLong(0), 3));
    }
    public void capturer(String id, BigDecimal montant, Long commandeId) {
        JsonNode p = appel("POST", "/payment_intents/" + identifiant(id) + "/capture", Map.of("amount_to_capture", Long.toString(millimes(montant))), "quartier-capture-" + id);
        if (!"succeeded".equals(p.path("status").asText()) || p.path("amount_received").asLong() != millimes(montant))
            throw MarketplaceException.conflit("La capture carte n'est pas confirmée.");
    }
    public void annuler(String sessionId, Long commandeId) {
        Autorisation a = verifier(sessionId);
        if ("succeeded".equals(a.statut())) appel("POST", "/refunds", Map.of("payment_intent", a.intentionId()), "quartier-rembourse-" + commandeId);
        else if ("requires_capture".equals(a.statut())) appel("POST", "/payment_intents/" + identifiant(a.intentionId()) + "/cancel", Map.of(), "quartier-annule-" + commandeId);
        else if (!"canceled".equals(a.statut())) appel("POST", "/checkout/sessions/" + identifiant(sessionId) + "/expire", Map.of(), "quartier-expire-" + commandeId);
    }
    static long millimes(BigDecimal montant) {
        long valeur = montant.movePointRight(3).longValueExact();
        if (valeur <= 0 || valeur % 10 != 0) throw new MarketplaceException(400, "PRECISION_CARTE", "Le total carte en TND doit être un multiple de 0,010 DT.");
        return valeur;
    }
    private static String identifiant(String id) {
        if (id == null || !id.matches("[A-Za-z0-9_]+")) throw MarketplaceException.conflit("Référence carte invalide."); return id;
    }
    private JsonNode appel(String methode, String chemin, Map<String, String> corps, String cle) {
        if (!active()) throw new MarketplaceException(503, "CARTE_INDISPONIBLE", "Le paiement carte n'est pas configuré.");
        String contenu = corps.entrySet().stream().sorted(Map.Entry.comparingByKey()).map(e -> encoder(e.getKey()) + "=" + encoder(e.getValue())).collect(Collectors.joining("&"));
        var b = HttpRequest.newBuilder(URI.create("https://api.stripe.com/v1" + chemin)).timeout(Duration.ofSeconds(10))
                .header("Authorization", "Bearer " + secret).header("Stripe-Version", "2026-11-18.endive")
                .header("Content-Type", "application/x-www-form-urlencoded")
                .method(methode, methode.equals("GET") ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(contenu));
        if (cle != null) b.header("Idempotency-Key", cle);
        try {
            var r = http.send(b.build(), HttpResponse.BodyHandlers.ofString());
            if (r.statusCode() / 100 != 2) throw new MarketplaceException(502, "CARTE_INDISPONIBLE", "Le prestataire carte ne peut pas traiter cette opération.");
            return json.readTree(r.body());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt(); throw new MarketplaceException(503, "CARTE_INDISPONIBLE", "Paiement interrompu. Réessayez.");
        } catch (java.io.IOException e) { throw new MarketplaceException(503, "CARTE_INDISPONIBLE", "Le prestataire carte est injoignable."); }
    }
    private static String encoder(String s) { return URLEncoder.encode(s, StandardCharsets.UTF_8); }
}
