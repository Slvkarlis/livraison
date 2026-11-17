package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Service.EstimationArrivee.Point;
import com.fleetpulse.livraison.Service.Itineraire.Course;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

/**
 * US-403 : regroupement de 2 a 3 collectes proches en un lot, par regles (mode degrade du service d'IA).
 *
 * <p>Glouton, de la commande prete la plus ancienne a la plus recente : chaque commande sans lot ouvre un lot,
 * puis on y ajoute, une a une, la commande compatible qui allonge le moins la tournee. Compatible :
 * <ul>
 *   <li>commerce dans la meme zone ou une zone adjacente (frontiere commune) ;</li>
 *   <li>commerces a moins de {@code rayonKm} l'un de l'autre ;</li>
 *   <li>pretes a moins de {@link #ECART_PRETE_MAX} d'intervalle (le premier colis n'attend pas le dernier) ;</li>
 *   <li>une tournee existe ou aucun colis ne reste plus de {@code aBordMax} a bord (Itineraire).</li>
 * </ul>
 * Un regroupement n'est garde que s'il fait gagner du temps par rapport a des livraisons separees.
 */
public final class RegroupementLots {
    public static final int TAILLE_MAX = 3;
    static final Duration ECART_PRETE_MAX = Duration.ofMinutes(10);

    private RegroupementLots() { }

    /** Commande prete en attente de coursier. */
    public record CommandeEnAttente(Long id, Long zoneId, Point commerce, Point client, Instant prete) {
        Course course() { return new Course(id, commerce, client); }
    }

    /** Lot propose : commandes dans l'ordre d'ajout, et la meilleure tournee trouvee. */
    public record LotPropose(List<CommandeEnAttente> commandes, Itineraire.Resultat itineraire) {
        public List<Long> ids() { return commandes.stream().map(CommandeEnAttente::id).toList(); }
    }

    /**
     * @param voisines pour chaque zone, les zones qui partagent une frontiere avec elle
     * @return une partition des commandes en lots ; une commande impossible a livrer dans la limite reste seule
     */
    public static List<LotPropose> regrouper(List<CommandeEnAttente> enAttente, Map<Long, Set<Long>> voisines,
                                             double rayonKm, double vitesseKmh, Duration aBordMax) {
        List<CommandeEnAttente> restantes = new ArrayList<>(enAttente);
        restantes.sort(Comparator.comparing(CommandeEnAttente::prete, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(CommandeEnAttente::id));
        List<LotPropose> lots = new ArrayList<>();
        while (!restantes.isEmpty()) {
            CommandeEnAttente graine = restantes.removeFirst();
            List<CommandeEnAttente> lot = new ArrayList<>(List.of(graine));
            Itineraire.Resultat tournee = tournee(lot, vitesseKmh, aBordMax).orElse(null);
            if (tournee == null) {
                // Commande seule trop loin pour la limite a bord : elle part quand meme, sans regroupement
                tournee = tournee(lot, vitesseKmh, null).orElse(null);
                lots.add(new LotPropose(lot, tournee));
                continue;
            }
            while (lot.size() < TAILLE_MAX) {
                CommandeEnAttente meilleure = null;
                Itineraire.Resultat meilleureTournee = null;
                for (CommandeEnAttente c : restantes) {
                    if (!compatible(graine, c, voisines, rayonKm)) continue;
                    List<CommandeEnAttente> essai = new ArrayList<>(lot);
                    essai.add(c);
                    Optional<Itineraire.Resultat> r = tournee(essai, vitesseKmh, aBordMax);
                    if (r.isEmpty() || !gagnant(r.get(), tournee, c, vitesseKmh)) continue;
                    if (meilleureTournee == null || r.get().duree().compareTo(meilleureTournee.duree()) < 0) {
                        meilleure = c;
                        meilleureTournee = r.get();
                    }
                }
                if (meilleure == null) break;
                lot.add(meilleure);
                restantes.remove(meilleure);
                tournee = meilleureTournee;
            }
            lots.add(new LotPropose(List.copyOf(lot), tournee));
        }
        return lots;
    }

    static boolean compatible(CommandeEnAttente a, CommandeEnAttente b, Map<Long, Set<Long>> voisines, double rayonKm) {
        boolean memeZone = Objects.equals(a.zoneId(), b.zoneId())
                || voisines.getOrDefault(a.zoneId(), Set.of()).contains(b.zoneId());
        if (!memeZone || a.commerce() == null || b.commerce() == null) return false;
        double km = Distances.km(a.commerce().latitude(), a.commerce().longitude(), b.commerce().latitude(), b.commerce().longitude());
        if (km > rayonKm) return false;
        if (a.prete() == null || b.prete() == null) return true;
        return Duration.between(a.prete(), b.prete()).abs().compareTo(ECART_PRETE_MAX) <= 0;
    }

    /** Le lot elargi doit etre plus court que la tournee actuelle suivie d'une livraison separee de la nouvelle commande. */
    static boolean gagnant(Itineraire.Resultat elargi, Itineraire.Resultat actuel, CommandeEnAttente ajout, double vitesseKmh) {
        Duration separee = Itineraire.trajet(ajout.commerce(), ajout.client(), vitesseKmh).plus(Itineraire.TEMPS_ARRET.multipliedBy(2));
        return elargi.duree().compareTo(actuel.duree().plus(separee)) < 0;
    }

    private static Optional<Itineraire.Resultat> tournee(List<CommandeEnAttente> lot, double vitesseKmh, Duration aBordMax) {
        return Itineraire.optimiser(null, lot.stream().map(CommandeEnAttente::course).toList(), vitesseKmh, aBordMax);
    }
}
