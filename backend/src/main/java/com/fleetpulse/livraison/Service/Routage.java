package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Service.EstimationArrivee.Point;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Trajet routier pour le guidage (US-307). OSRM quand une URL est configuree (app.routage.osrm-url),
 * sinon estimation a vol d'oiseau avec le facteur de detour urbain (meme regle que les lots et les ETA).
 * Une panne d'OSRM ne bloque jamais le coursier : on retombe sur l'estimation et la source le dit.
 */
@Component
public class Routage {
    private static final Logger log = LoggerFactory.getLogger(Routage.class);

    /** Trace du trajet : distance, duree, source (osrm ou estimation) et geometrie [lat, lng] si connue. */
    public record Trajet(double distanceKm, double dureeMinutes, String source, List<List<Double>> geometrie) { }

    private final String osrmUrl;
    private final Duration delai = Duration.ofSeconds(3);
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(delai).build();
    private final JsonMapper json = JsonMapper.builder().build();

    public Routage(@Value("${app.routage.osrm-url:}") String osrmUrl) {
        this.osrmUrl = osrmUrl == null ? "" : osrmUrl.trim().replaceAll("/+$", "");
    }

    public Trajet trajet(Point de, Point vers, double vitesseKmh) {
        if (!osrmUrl.isEmpty()) {
            try {
                return osrm(de, vers);
            } catch (Exception e) {
                log.warn("OSRM indisponible ({}), estimation a vol d'oiseau", e.getMessage());
            }
        }
        double km = Distances.km(de.latitude(), de.longitude(), vers.latitude(), vers.longitude()) * EstimationArrivee.FACTEUR_DETOUR;
        return new Trajet(round(km), round(km / Math.max(1, vitesseKmh) * 60), "estimation", List.of());
    }

    private Trajet osrm(Point de, Point vers) throws Exception {
        String chemin = String.format(java.util.Locale.ROOT, "/route/v1/driving/%f,%f;%f,%f?overview=full&geometries=geojson",
                de.longitude(), de.latitude(), vers.longitude(), vers.latitude());
        HttpRequest requete = HttpRequest.newBuilder(URI.create(osrmUrl + chemin)).timeout(delai).GET().build();
        HttpResponse<String> reponse = http.send(requete, HttpResponse.BodyHandlers.ofString());
        if (reponse.statusCode() != 200) throw new IllegalStateException("statut " + reponse.statusCode());
        JsonNode route = json.readTree(reponse.body()).path("routes").path(0);
        if (route.isMissingNode()) throw new IllegalStateException("aucune route");
        List<List<Double>> geometrie = new ArrayList<>();
        for (JsonNode p : route.path("geometry").path("coordinates")) {
            geometrie.add(List.of(p.get(1).asDouble(), p.get(0).asDouble()));   // GeoJSON [lng, lat] -> [lat, lng]
        }
        return new Trajet(round(route.path("distance").asDouble() / 1000), round(route.path("duration").asDouble() / 60), "osrm", geometrie);
    }

    static double round(double v) { return Math.round(v * 100.0) / 100.0; }
}
