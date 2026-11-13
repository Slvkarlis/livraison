package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Model.enums.StatutLivraison;
import java.time.Duration;
import java.time.Instant;
import java.util.EnumSet;
import java.util.Optional;
import java.util.Set;

/**
 * US-303 : heure d'arrivee estimee par regles, en attendant l'ETA par IA (US-406, Sprint 4).
 *
 * <p>ETA = fin de preparation annoncee (si elle n'est pas passee) + trajet restant.
 * Trajet = distance a vol d'oiseau x {@link #FACTEUR_DETOUR} (les rues ne sont pas droites), a la vitesse moyenne de la zone.
 * <ul>
 *   <li>avant la collecte : coursier -> commerce (s'il est connu), puis commerce -> client, plus {@link #TEMPS_COLLECTE} ;</li>
 *   <li>colis a bord : coursier (ou commerce si sa position est inconnue) -> client.</li>
 * </ul>
 * Les autres missions d'un meme coursier ne sont pas prises en compte : ce sera le role du dispatch par lots.
 */
public final class EstimationArrivee {
    static final double FACTEUR_DETOUR = 1.3;
    /** Temps passe a la boutique (stationnement, scan du colis). */
    static final Duration TEMPS_COLLECTE = Duration.ofMinutes(2);

    private static final Set<StatutLivraison> AVANT_COLLECTE =
            EnumSet.of(StatutLivraison.ACCEPTEE, StatutLivraison.EN_PREPARATION, StatutLivraison.PRETE, StatutLivraison.AFFECTEE);
    private static final Set<StatutLivraison> COLIS_A_BORD = EnumSet.of(StatutLivraison.RECUPEREE, StatutLivraison.A_PROXIMITE);

    private EstimationArrivee() { }

    public record Point(double latitude, double longitude) { }

    /**
     * @param livreur position connue du coursier, ou null
     * @param pretePrevue fin de preparation annoncee par le commerce, ou null
     * @return vide si la commande n'est pas (ou plus) en cours de livraison
     */
    public static Optional<Instant> heure(StatutLivraison statut, Instant maintenant, Instant pretePrevue,
                                          Point commerce, Point client, Point livreur, double vitesseKmh) {
        if (commerce == null || client == null || vitesseKmh <= 0) return Optional.empty();
        if (COLIS_A_BORD.contains(statut))
            return Optional.of(maintenant.plus(trajet(livreur != null ? livreur : commerce, client, vitesseKmh)));
        if (!AVANT_COLLECTE.contains(statut)) return Optional.empty();

        Instant depart = pretePrevue != null && pretePrevue.isAfter(maintenant) ? pretePrevue : maintenant;
        if (statut == StatutLivraison.AFFECTEE && livreur != null) {
            Instant coursierALaBoutique = maintenant.plus(trajet(livreur, commerce, vitesseKmh));
            if (coursierALaBoutique.isAfter(depart)) depart = coursierALaBoutique;
        }
        return Optional.of(depart.plus(TEMPS_COLLECTE).plus(trajet(commerce, client, vitesseKmh)));
    }

    static Duration trajet(Point de, Point vers, double vitesseKmh) {
        double km = Distances.km(de.latitude(), de.longitude(), vers.latitude(), vers.longitude()) * FACTEUR_DETOUR;
        return Duration.ofSeconds(Math.round(km / vitesseKmh * 3600));
    }
}
