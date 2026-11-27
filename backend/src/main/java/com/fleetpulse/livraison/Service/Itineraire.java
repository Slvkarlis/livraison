package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Service.EstimationArrivee.Point;
import java.time.Duration;
import java.util.*;

/**
 * US-404 : ordre optimal des collectes et des livraisons d'un lot, sous contrainte de duree maximale a bord.
 *
 * <p>Un lot compte au plus 3 commandes, soit 6 arrets : toutes les tournees valides (chaque collecte avant
 * la livraison de la meme commande) sont explorees, ce qui donne l'optimum exact en quelques centaines d'essais.
 * Le service d'IA (OR-Tools) prend le relais pour de plus grands lots ; ce calcul reste le mode degrade.
 *
 * <p>Duree d'un trajet : distance a vol d'oiseau x {@link EstimationArrivee#FACTEUR_DETOUR} a la vitesse de la zone,
 * plus {@link #TEMPS_ARRET} a chaque arret (stationnement, scan). Une commande deja a bord n'a plus que sa livraison.
 */
public final class Itineraire {
    /** Temps passe a chaque arret : collecte au commerce ou remise au client. */
    static final Duration TEMPS_ARRET = Duration.ofMinutes(2);

    private Itineraire() { }

    public enum TypeEtape { COLLECTE, LIVRAISON }

    /** Une commande du lot : ou la prendre et ou la livrer. aBord : deja collectee (seule la livraison reste). */
    public record Course(Long commandeId, Point commerce, Point client, boolean aBord) {
        public Course(Long commandeId, Point commerce, Point client) { this(commandeId, commerce, client, false); }
    }

    /** arrivee : temps ecoule depuis le depart jusqu'a l'arrivee a cet arret. */
    public record Etape(Long commandeId, TypeEtape type, Point point, Duration arrivee) {
        public String code() { return (type == TypeEtape.COLLECTE ? "C:" : "L:") + commandeId; }
    }

    /** aBord : pour chaque commande, temps entre sa collecte et sa livraison. */
    public record Resultat(List<Etape> etapes, double distanceKm, Duration duree, Map<Long, Duration> aBord) {
        /** Itineraire compact stocke sur le lot : « C:12;C:13;L:12;L:13 ». */
        public String code() { return String.join(";", etapes.stream().map(Etape::code).toList()); }

        /** Temps entre le depart et la remise de cette commande au client. */
        public Optional<Duration> livraison(Long commandeId) {
            return etapes.stream().filter(e -> e.type() == TypeEtape.LIVRAISON && e.commandeId().equals(commandeId))
                    .map(Etape::arrivee).findFirst();
        }
    }

    /**
     * @param depart position du coursier, ou null : la tournee commence alors au premier arret
     * @return vide si aucune tournee ne respecte la duree maximale a bord (ou si le lot est vide)
     */
    public static Optional<Resultat> optimiser(Point depart, List<Course> courses, double vitesseKmh, Duration aBordMax) {
        return optimiser(depart, courses, vitesseKmh, aBordMax, java.time.Instant.EPOCH, Map.of());
    }

    /** Variante quartier : chaque remise, arrêt compris, doit précéder la promesse individuelle. */
    public static Optional<Resultat> optimiser(Point depart, List<Course> courses, double vitesseKmh, Duration aBordMax,
                                               java.time.Instant heureDepart, Map<Long, java.time.Instant> promesses) {
        if (courses == null || courses.isEmpty() || vitesseKmh <= 0) return Optional.empty();
        if (courses.size() > 4) throw new IllegalArgumentException("Un lot compte au plus 4 commandes.");
        Recherche r = new Recherche(courses, vitesseKmh, aBordMax, heureDepart, promesses);
        r.explorer(depart, new ArrayList<>(), new HashMap<>(), Duration.ZERO, 0, new HashSet<>(), new HashSet<>());
        return Optional.ofNullable(r.meilleur);
    }

    /** Arret d'un itineraire compact (« C:12 » ou « L:12 »). */
    public record Arret(TypeEtape type, Long commandeId) { }

    /** Decode l'itineraire stocke sur le lot ; les elements illisibles sont ignores. */
    public static List<Arret> decoder(String code) {
        List<Arret> arrets = new ArrayList<>();
        if (code == null || code.isBlank()) return arrets;
        for (String element : code.split(";")) {
            String[] parties = element.trim().split(":");
            if (parties.length != 2 || !parties[1].matches("[0-9]{1,18}")) continue;
            TypeEtape type = "C".equals(parties[0]) ? TypeEtape.COLLECTE : "L".equals(parties[0]) ? TypeEtape.LIVRAISON : null;
            if (type != null) arrets.add(new Arret(type, Long.valueOf(parties[1])));
        }
        return arrets;
    }

    /** Nombre de commandes d'un itineraire compact : une livraison par commande. */
    public static int compterCommandes(String code) {
        return (int) decoder(code).stream().filter(a -> a.type() == TypeEtape.LIVRAISON).count();
    }

    /** Duree d'un trajet entre deux points a la vitesse donnee (detour urbain compris), sans temps d'arret. */
    public static Duration trajet(Point de, Point vers, double vitesseKmh) {
        return Duration.ofSeconds(Math.round(km(de, vers) / vitesseKmh * 3600));
    }

    static double km(Point de, Point vers) {
        return Distances.km(de.latitude(), de.longitude(), vers.latitude(), vers.longitude()) * EstimationArrivee.FACTEUR_DETOUR;
    }

    /** Parcours en profondeur de toutes les tournees valides ; garde la plus courte en duree, puis en distance. */
    private static final class Recherche {
        private final List<Course> courses;
        private final double vitesse;
        private final Duration aBordMax;
        private final java.time.Instant heureDepart;
        private final Map<Long, java.time.Instant> promesses;
        private Resultat meilleur;

        Recherche(List<Course> courses, double vitesse, Duration aBordMax, java.time.Instant heureDepart, Map<Long, java.time.Instant> promesses) {
            this.courses = courses;
            this.vitesse = vitesse;
            this.aBordMax = aBordMax;
            this.heureDepart = heureDepart;
            this.promesses = promesses;
        }

        void explorer(Point position, List<Etape> etapes, Map<Long, Duration> collecteLe, Duration ecoule, double km,
                      Set<Long> collectees, Set<Long> livrees) {
            if (livrees.size() == courses.size()) {
                Map<Long, Duration> aBord = new HashMap<>();
                for (Etape e : etapes)
                    if (e.type() == TypeEtape.LIVRAISON)
                        aBord.put(e.commandeId(), e.arrivee().minus(collecteLe.getOrDefault(e.commandeId(), Duration.ZERO)));
                Resultat r = new Resultat(List.copyOf(etapes), km, ecoule, Map.copyOf(aBord));
                if (meilleur == null || r.duree().compareTo(meilleur.duree()) < 0
                        || (r.duree().equals(meilleur.duree()) && r.distanceKm() < meilleur.distanceKm()))
                    meilleur = r;
                return;
            }
            // Elagage : une tournee partielle deja plus longue que la meilleure ne peut pas devenir meilleure
            if (meilleur != null && ecoule.compareTo(meilleur.duree()) > 0) return;
            for (Course c : courses) {
                boolean aCollecter = !c.aBord() && !collectees.contains(c.commandeId());
                boolean aLivrer = !livrees.contains(c.commandeId()) && (c.aBord() || collectees.contains(c.commandeId()));
                if (aCollecter) avancer(c, TypeEtape.COLLECTE, c.commerce(), position, etapes, collecteLe, ecoule, km, collectees, livrees);
                else if (aLivrer) avancer(c, TypeEtape.LIVRAISON, c.client(), position, etapes, collecteLe, ecoule, km, collectees, livrees);
            }
        }

        private void avancer(Course c, TypeEtape type, Point cible, Point position, List<Etape> etapes, Map<Long, Duration> collecteLe,
                             Duration ecoule, double km, Set<Long> collectees, Set<Long> livrees) {
            double distance = position == null ? 0 : km(position, cible);
            Duration arrivee = position == null ? ecoule : ecoule.plus(trajet(position, cible, vitesse));
            if (type == TypeEtape.LIVRAISON && promesses.containsKey(c.commandeId())
                    && heureDepart.plus(arrivee).plus(TEMPS_ARRET).isAfter(promesses.get(c.commandeId()))) return;
            if (type == TypeEtape.LIVRAISON && !c.aBord() && aBordMax != null
                    && arrivee.minus(collecteLe.get(c.commandeId())).compareTo(aBordMax) > 0) return;   // colis trop longtemps a bord
            etapes.add(new Etape(c.commandeId(), type, cible, arrivee));
            Duration apresArret = arrivee.plus(TEMPS_ARRET);
            if (type == TypeEtape.COLLECTE) { collectees.add(c.commandeId()); collecteLe.put(c.commandeId(), apresArret); }
            else livrees.add(c.commandeId());
            explorer(cible, etapes, collecteLe, apresArret, km + distance, collectees, livrees);
            if (type == TypeEtape.COLLECTE) { collectees.remove(c.commandeId()); collecteLe.remove(c.commandeId()); }
            else livrees.remove(c.commandeId());
            etapes.removeLast();
        }
    }
}
