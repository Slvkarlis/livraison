package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Model.Livreur;
import com.fleetpulse.livraison.Model.enums.TypeAffectation;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * US-402 : choix du coursier le plus adapte a un lot, par score (plus petit = meilleur).
 *
 * <p>score = distance du coursier a la premiere collecte (km)
 * + penalite de zone (secondaire, renfort, debordement depuis une zone voisine)
 * + penalite de charge (missions deja en cours).
 * Une penalite s'exprime en « kilometres equivalents » : un coursier de zone principale a 3 km
 * passe devant un coursier en debordement a 1 km. Position inconnue : {@link #DISTANCE_INCONNUE_KM}.
 */
public final class ChoixLivreur {
    static final double PENALITE_SECONDAIRE_KM = 1.5;
    static final double PENALITE_RENFORT_KM = 0.5;
    static final double PENALITE_DEBORDEMENT_KM = 4;
    static final double PENALITE_PAR_MISSION_KM = 1;
    static final double DISTANCE_INCONNUE_KM = 5;

    private ChoixLivreur() { }

    /**
     * Coursier candidat. type : son affectation a la zone du lot ; null s'il vient d'une zone voisine (debordement).
     * distanceKm : jusqu'a la premiere collecte, null si sa position est inconnue.
     */
    public record Candidat(Livreur livreur, TypeAffectation type, long missions, Double distanceKm) {
        public boolean horsZone() { return type == null; }
    }

    public static double score(Candidat c) {
        double penaliteZone = c.type() == null ? PENALITE_DEBORDEMENT_KM : switch (c.type()) {
            case PRINCIPALE -> 0;
            case SECONDAIRE -> PENALITE_SECONDAIRE_KM;
            case TEMPORAIRE -> PENALITE_RENFORT_KM;
        };
        double distance = c.distanceKm() == null ? DISTANCE_INCONNUE_KM : c.distanceKm();
        return distance + penaliteZone + c.missions() * PENALITE_PAR_MISSION_KM;
    }

    /** Meilleur candidat ; a score egal, le moins charge puis le plus ancien compte (resultat stable). */
    public static Optional<Candidat> meilleur(List<Candidat> candidats) {
        return candidats.stream().min(Comparator.comparingDouble(ChoixLivreur::score)
                .thenComparingLong(Candidat::missions)
                .thenComparing(c -> c.livreur().getId()));
    }
}
