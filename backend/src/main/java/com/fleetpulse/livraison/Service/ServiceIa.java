package com.fleetpulse.livraison.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.json.JsonMapper;

/**
 * Client du service d'IA Python (dossier ia/, FastAPI) : regroupement en lots (US-403) et ETA predictive (US-406).
 *
 * <p>Toujours facultatif (cahier des charges §4.1) : sans URL configuree, ou si le service ne repond pas dans
 * le delai, chaque methode renvoie vide et l'appelant applique les regles Java (mode degrade).
 */
@Component
public class ServiceIa {
    private static final Logger log = LoggerFactory.getLogger(ServiceIa.class);
    private final String url;
    private final Duration delai;
    private final HttpClient http;
    private final JsonMapper json = JsonMapper.builder().disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES).build();

    public ServiceIa(@Value("${app.ia.url:}") String url, @Value("${app.ia.delai-ms:800}") long delaiMs) {
        this.url = url == null ? "" : url.trim().replaceAll("/+$", "");
        this.delai = Duration.ofMillis(Math.max(100, delaiMs));
        this.http = HttpClient.newBuilder().connectTimeout(delai).build();
    }

    public boolean actif() { return !url.isEmpty(); }

    // Contrat JSON partage avec ia/fleetpulse_ia/app.py
    public record CaracteristiquesEta(Long partenaireId, int preparationAnnonceeMin, double distanceKm, double vitesseZoneKmh,
                                      int heure, int jourSemaine, int tailleLot) { }
    public record PredictionEta(double preparationMin, double trajetMin, String modele) { }
    public record PositionIa(double latitude, double longitude) { }
    public record CommandeIa(Long id, Long zoneId, PositionIa commerce, PositionIa client, long preteDepuisSecondes) { }
    public record DemandeLots(List<CommandeIa> commandes, Map<String, List<Long>> voisines, double rayonKm, double vitesseKmh,
                              int aBordMaxMinutes) { }
    public record LotIa(List<Long> commandes, List<String> itineraire) { }
    public record ReponseLots(List<LotIa> lots, String moteur) { }

    public Optional<PredictionEta> predireEta(CaracteristiquesEta c) {
        return appeler("/v1/eta", c, PredictionEta.class)
                .filter(p -> Double.isFinite(p.preparationMin()) && Double.isFinite(p.trajetMin())
                        && p.preparationMin() >= 0 && p.trajetMin() >= 0 && p.preparationMin() < 600 && p.trajetMin() < 600);
    }

    public Optional<ReponseLots> proposerLots(DemandeLots demande) {
        return appeler("/v1/lots", demande, ReponseLots.class).filter(r -> r.lots() != null);
    }

    // Sprint 8 : prevision de demande (US-804), score de prospection (US-802), reentrainement (US-806)
    public record DemandeIa(Long zoneId, int jourSemaine, int heure, boolean ferie, int partenairesActifs) { }
    public record PrevisionIa(Long zoneId, int jourSemaine, int heure, double commandesPrevues, String regle) { }
    public record ReponsePrevisions(List<PrevisionIa> previsions, String modele) { }
    public record ProspectIa(String categorie, double distanceClientsKm, int clientsZone, double couvertureZonePct, int concurrentsProches) { }
    public record ScoreIa(double score, String modele) { }
    public record ReponseScores(List<ScoreIa> scores, String modele) { }

    public Optional<ReponsePrevisions> predireDemande(List<DemandeIa> demandes) {
        if (demandes.isEmpty()) return Optional.empty();
        return appeler("/v1/demande/predire", demandes, ReponsePrevisions.class)
                .filter(r -> r.previsions() != null && r.previsions().size() == demandes.size());
    }

    public Optional<ReponseScores> scorerProspects(List<ProspectIa> prospects) {
        if (prospects.isEmpty()) return Optional.empty();
        return appeler("/v1/prospection/score", prospects, ReponseScores.class)
                .filter(r -> r.scores() != null && r.scores().size() == prospects.size()
                        && r.scores().stream().allMatch(sc -> sc.score() >= 0 && sc.score() <= 100));
    }

    /** Reentrainement distant (US-806) : jeu = liste de lignes au format du contrat ia/handoff/CONTRATS.md. */
    public Optional<Map<String, Object>> reentrainer(String modele, Object jeu) {
        return appeler("/v1/entrainement/" + modele, jeu, (Class<Map<String, Object>>) (Class<?>) Map.class);
    }

    private <T> Optional<T> appeler(String chemin, Object corps, Class<T> type) {
        if (!actif()) return Optional.empty();
        try {
            HttpRequest requete = HttpRequest.newBuilder(URI.create(url + chemin)).timeout(delai)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(corps))).build();
            HttpResponse<String> reponse = http.send(requete, HttpResponse.BodyHandlers.ofString());
            if (reponse.statusCode() != 200) {
                log.warn("Service d'IA {} : statut {}, regles appliquees", chemin, reponse.statusCode());
                return Optional.empty();
            }
            return Optional.ofNullable(json.readValue(reponse.body(), type));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Optional.empty();
        } catch (Exception e) {
            // Mode degrade : l'IA ne bloque jamais une commande
            log.warn("Service d'IA {} indisponible ({}), regles appliquees", chemin, e.getMessage());
            return Optional.empty();
        }
    }
}
