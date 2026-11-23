package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Service.EstimationArrivee.Point;
import com.fleetpulse.livraison.Service.Itineraire.Course;
import com.fleetpulse.livraison.Service.RegroupementLots.CommandeEnAttente;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * US-518 : simulateur de regroupement. Compare les lots (regroupement avec rayon R et fenetre t) au dispatch unitaire
 * (une tournee par commande), sur un jeu de commandes donne, pour calibrer R et t avant le pilote.
 * Aucune commande reelle n'est touchee : le calcul est pur.
 */
@Service @RequiredArgsConstructor
public class SimulateurLots {
    static final int COMMANDES_MAX = 300;
    static final List<Double> RAYONS_KM = List.of(0.5, 1.0, 1.5, 2.0);
    static final List<Integer> FENETRES_MIN = List.of(15, 30, 45);

    public record Commande(Long id, Long zoneId, Point commerce, Point client) { }

    public record Scenario(Point depart, double vitesseKmh, List<Commande> commandes, Map<Long, Set<Long>> voisines) { }

    public record Bilan(int tournees, double km, double minutes) { }

    public record Combinaison(double rayonKm, int fenetreMin, Bilan lots, double economieKmPct, double economieMinPct) { }

    public record Resultat(Bilan unitaire, List<Combinaison> combinaisons, Combinaison recommandee) { }

    public Resultat simuler(Scenario s) {
        if (s.commandes() == null || s.commandes().isEmpty()) throw new IllegalArgumentException("Aucune commande à simuler.");
        if (s.commandes().size() > COMMANDES_MAX) throw new IllegalArgumentException(COMMANDES_MAX + " commandes au plus par simulation.");
        if (s.vitesseKmh() <= 0) throw new IllegalArgumentException("Vitesse : supérieure à zéro.");
        Bilan unitaire = unitaire(s);
        List<Combinaison> combinaisons = new ArrayList<>();
        for (double rayon : RAYONS_KM) {
            for (int fenetre : FENETRES_MIN) {
                Bilan lots = lots(s, rayon, fenetre);
                combinaisons.add(new Combinaison(rayon, fenetre, lots,
                        pourcent(unitaire.km(), lots.km()), pourcent(unitaire.minutes(), lots.minutes())));
            }
        }
        // Recommandee : plus grand gain de minutes, sans allonger les tournees de plus de 10 % par rapport a l'unitaire
        Combinaison recommandee = combinaisons.stream()
                .filter(c -> c.lots().minutes() <= unitaire.minutes() * 1.10 || c.economieMinPct() > 0)
                .max(Comparator.comparingDouble(Combinaison::economieMinPct)
                        .thenComparingDouble(Combinaison::economieKmPct))
                .orElse(null);
        return new Resultat(unitaire, combinaisons, recommandee);
    }

    private static Bilan unitaire(Scenario s) {
        int tournees = 0;
        double km = 0, minutes = 0;
        for (Commande c : s.commandes()) {
            Optional<Itineraire.Resultat> r = Itineraire.optimiser(s.depart(), List.of(new Course(c.id(), c.commerce(), c.client())),
                    s.vitesseKmh(), Duration.ofDays(1));
            if (r.isEmpty()) continue;
            tournees++;
            km += r.get().distanceKm();
            minutes += r.get().duree().toSeconds() / 60.0;
        }
        return new Bilan(tournees, arrondi(km), arrondi(minutes));
    }

    private static Bilan lots(Scenario s, double rayon, int fenetreMin) {
        List<CommandeEnAttente> attente = s.commandes().stream()
                .map(c -> new CommandeEnAttente(c.id(), c.zoneId(), c.commerce(), c.client(), Instant.EPOCH)).toList();
        List<RegroupementLots.LotPropose> lots = RegroupementLots.regrouper(attente, s.voisines(), rayon, s.vitesseKmh(),
                Duration.ofMinutes(fenetreMin));
        double km = 0, minutes = 0;
        for (RegroupementLots.LotPropose lot : lots) {
            km += lot.itineraire().distanceKm();
            minutes += lot.itineraire().duree().toSeconds() / 60.0;
        }
        return new Bilan(lots.size(), arrondi(km), arrondi(minutes));
    }

    private static double pourcent(double reference, double valeur) {
        return reference <= 0 ? 0 : arrondi(100.0 * (reference - valeur) / reference);
    }

    static double arrondi(double v) { return Math.round(v * 100.0) / 100.0; }
}
