package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Service.EstimationArrivee.Point;
import java.math.*;
import java.time.*;
import java.util.*;

/** Simulation déterministe à demandes constantes ; seules les heures des adhérents sont avancées par invitation. */
public final class SimulationQuartier {
    private SimulationQuartier() { }
    public record Demande(Long id, Long commerceId, Long zoneId, Point commerce, Point client, int creationSecondes,
                          int preparationSecondes, int promesseSecondes, BigDecimal frais) { }
    public record Scenario(Point depart, double vitesseKmh, List<Demande> commandes, double tauxAdhesion,
                           int fenetreSecondes, double rayonMetres) { }
    public record Indicateurs(String mode, int commandes, int tournees, double kmTotaux, BigDecimal coutParCommande,
                               double commandesParCoursierHeure, double aHeurePct, BigDecimal fraisMoyenClient) { }
    public record Comparaison(double tauxAdhesion, List<Indicateurs> scenarios) { }
    private record Tournee(List<Demande> membres, Instant depart, Itineraire.Resultat route, boolean quartier) { }

    public static Comparaison comparer(Scenario s) {
        if (s == null || s.commandes() == null || s.commandes().isEmpty() || s.commandes().size() > 300
                || !Double.isFinite(s.vitesseKmh()) || s.vitesseKmh() < 5 || s.vitesseKmh() > 80
                || !Double.isFinite(s.tauxAdhesion()) || s.tauxAdhesion() < 0 || s.tauxAdhesion() > 1
                || s.fenetreSecondes() < 1 || s.fenetreSecondes() > 900 || !Double.isFinite(s.rayonMetres()) || s.rayonMetres() < 10 || s.rayonMetres() > 2000)
            throw new IllegalArgumentException("Simulation : 1–300 commandes, adhésion 0–1, fenêtre 1–900 s, rayon 10–2000 m, vitesse 5–80 km/h.");
        Set<Long> ids = new HashSet<>();
        for (Demande c : s.commandes()) {
            if (c == null || c.id() == null || !ids.add(c.id()) || c.commerceId() == null || c.zoneId() == null
                    || !point(c.commerce()) || !point(c.client()) || c.creationSecondes() < 0 || c.preparationSecondes() < 0
                    || c.promesseSecondes() < c.creationSecondes() || c.frais() == null || c.frais().signum() < 0)
                throw new IllegalArgumentException("Commande simulée invalide : identité unique, points, dates et frais requis.");
        }
        if (s.depart() != null && !point(s.depart())) throw new IllegalArgumentException("Départ invalide.");
        List<Tournee> seules = s.commandes().stream().map(c -> tournee(s, List.of(c), c.creationSecondes() + c.preparationSecondes(), false, false)).toList();
        return new Comparaison(s.tauxAdhesion(), List.of(bilan("SANS_LOTS", s, seules),
                bilan("LOTS", s, lots(s, s.commandes())), bilan("LOTS_QUARTIER", s, quartier(s))));
    }

    private static boolean point(Point p) { return p != null && Double.isFinite(p.latitude()) && Double.isFinite(p.longitude())
            && Math.abs(p.latitude()) <= 90 && Math.abs(p.longitude()) <= 180; }

    private static List<Tournee> lots(Scenario s, List<Demande> demandes) {
        List<Demande> restantes = new ArrayList<>(demandes); restantes.sort(Comparator.comparingInt(c -> c.creationSecondes() + c.preparationSecondes()));
        List<Tournee> resultat = new ArrayList<>();
        while (!restantes.isEmpty()) {
            Demande premiere = restantes.getFirst();
            int prete = premiere.creationSecondes() + premiere.preparationSecondes();
            List<Demande> disponibles = restantes.stream().filter(c -> c.creationSecondes() + c.preparationSecondes() <= prete + 30).toList();
            Map<Long, Demande> parId = new HashMap<>(); disponibles.forEach(c -> parId.put(c.id(), c));
            var enAttente = disponibles.stream().map(c -> new RegroupementLots.CommandeEnAttente(c.id(), c.zoneId(), c.commerce(), c.client(),
                    Instant.EPOCH.plusSeconds(c.creationSecondes() + c.preparationSecondes()))).toList();
            // Exactement le moteur Java du dispatch actuel, avec les mêmes rayon et durée à bord par défaut.
            for (var lot : RegroupementLots.regrouper(enAttente, Map.of(), 1.5, s.vitesseKmh(), Duration.ofMinutes(35))) {
                List<Demande> membres = lot.ids().stream().map(parId::get).toList();
                resultat.add(tournee(s, membres, prete + 30, false, false));
            }
            restantes.removeAll(disponibles);
        }
        return resultat;
    }

    private static List<Tournee> quartier(Scenario s) {
        List<Demande> restantes = new ArrayList<>(s.commandes()); restantes.sort(Comparator.comparingInt(Demande::creationSecondes).thenComparing(Demande::id));
        List<Demande> ordinaires = new ArrayList<>(); List<Tournee> resultat = new ArrayList<>();
        while (!restantes.isEmpty()) {
            Demande premiere = restantes.removeFirst(); List<Demande> groupe = new ArrayList<>(List.of(premiere));
            int depart = premiere.creationSecondes() + s.fenetreSecondes() + premiere.preparationSecondes();
            // Même borne conservatrice que l'ouverture réelle ; ne pas promettre une fenêtre impossible.
            if (tournee(s, groupe, depart, true, true) == null) { ordinaires.add(premiere); continue; }
            for (Demande c : new ArrayList<>(restantes)) {
                if (groupe.size() == RegroupementLots.TAILLE_MAX) break;
                double tirage = new Random(c.id() * 7919L).nextDouble();
                if (tirage >= s.tauxAdhesion() || !Objects.equals(c.commerceId(), premiere.commerceId())
                        || !Objects.equals(c.zoneId(), premiere.zoneId()) || c.creationSecondes() - premiere.creationSecondes() > 1800
                        || Distances.km(premiere.client().latitude(), premiere.client().longitude(), c.client().latitude(), c.client().longitude()) * 1000 > s.rayonMetres()) continue;
                // L'invitation avance une demande existante dans la fenêtre ; sa promesse d'origine est conservée.
                List<Demande> essai = new ArrayList<>(groupe); essai.add(c);
                int futurDepart = Math.max(depart, premiere.creationSecondes() + s.fenetreSecondes() + c.preparationSecondes());
                if (tournee(s, essai, futurDepart, true, true) != null) { groupe.add(c); restantes.remove(c); depart = futurDepart; }
            }
            if (groupe.size() > 1) resultat.add(tournee(s, groupe, depart, true, true)); else ordinaires.add(premiere);
        }
        resultat.addAll(lots(s, ordinaires)); return resultat;
    }

    private static Tournee tournee(Scenario s, List<Demande> membres, int depart, boolean quartier, boolean garantir) {
        Map<Long, Instant> promesses = new HashMap<>();
        if (garantir) membres.forEach(c -> promesses.put(c.id(), Instant.EPOCH.plusSeconds(c.promesseSecondes())));
        var r = Itineraire.optimiser(s.depart(), membres.stream().map(c -> new Itineraire.Course(c.id(), c.commerce(), c.client())).toList(),
                s.vitesseKmh(), membres.size() > 1 ? Duration.ofMinutes(35) : null, Instant.EPOCH.plusSeconds(depart), promesses);
        return r.map(route -> new Tournee(List.copyOf(membres), Instant.EPOCH.plusSeconds(depart), route, quartier)).orElse(null);
    }

    private static Indicateurs bilan(String mode, Scenario s, List<Tournee> tournees) {
        double km = 0, secondes = 0; int aHeure = 0; BigDecimal frais = BigDecimal.ZERO;
        for (Tournee t : tournees) {
            km += t.route().distanceKm(); secondes += t.route().duree().toSeconds();
            for (int i = 0; i < t.membres().size(); i++) {
                Demande c = t.membres().get(i);
                Instant remise = t.depart().plus(t.route().livraison(c.id()).orElseThrow()).plus(Itineraire.TEMPS_ARRET);
                if (!remise.isAfter(Instant.EPOCH.plusSeconds(c.promesseSecondes()))) aHeure++;
                frais = frais.add(t.quartier() ? TarificationQuartier.frais(c.frais(), null, t.membres().size(), i == t.membres().size() - 1,
                        new BigDecimal("0.40"), new BigDecimal("0.50")) : c.frais());
            }
        }
        int n = s.commandes().size();
        // Rémunérations individuelles inchangées + coût variable des trajets à 0,500 DT/km.
        BigDecimal salaires = s.commandes().stream().map(c -> new BigDecimal("3.000").add(BigDecimal.valueOf(Itineraire.km(c.commerce(), c.client())).multiply(new BigDecimal("0.500"))))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal cout = salaires.add(BigDecimal.valueOf(km).multiply(new BigDecimal("0.500"))).divide(BigDecimal.valueOf(n), 3, RoundingMode.HALF_UP);
        return new Indicateurs(mode, n, tournees.size(), arrondi(km), cout, secondes == 0 ? 0 : arrondi(n * 3600.0 / secondes),
                arrondi(aHeure * 100.0 / n), frais.divide(BigDecimal.valueOf(n), 3, RoundingMode.HALF_UP));
    }
    private static double arrondi(double v) { return Math.round(v * 1000) / 1000.0; }
}
