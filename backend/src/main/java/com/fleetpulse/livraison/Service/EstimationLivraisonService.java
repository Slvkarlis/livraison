package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.StatutLot;
import com.fleetpulse.livraison.Repository.LivraisonRepository;
import com.fleetpulse.livraison.Service.EstimationArrivee.Point;
import com.fleetpulse.livraison.Service.Itineraire.Course;
import java.time.Duration;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * US-406 : heure de livraison promise au client, figee a l'acceptation par le commerce, puis ETA actualisee.
 *
 * <p>Promesse = max(preparation predite, approche du coursier) + collecte + trajet commerce -> client + marge.
 * La preparation et le trajet viennent du service d'IA quand il repond ; sinon (mode degrade) :
 * preparation annoncee x ponctualite observee du commerce (ses 20 dernieres commandes), trajet par regles.
 *
 * <p>ETA actualisee : position reelle du coursier et reste de l'itineraire de son lot (US-404) ;
 * avant la collecte, la fin de preparation tient compte de la ponctualite du commerce.
 */
@Service @RequiredArgsConstructor @Transactional(readOnly = true)
public class EstimationLivraisonService {
    /** Temps moyen pour qu'un coursier rejoigne le commerce une fois l'offre acceptee. */
    static final Duration APPROCHE_COURSIER = Duration.ofMinutes(5);
    static final double MARGE = 0.15;
    static final Duration MARGE_MIN = Duration.ofMinutes(5);
    /** Bornes de la ponctualite apprise : un commerce n'est jamais suppose 2 fois plus lent ou plus rapide que son annonce. */
    static final double RATIO_MIN = 0.8, RATIO_MAX = 1.5;
    static final String IA = "IA", REGLES = "REGLES";

    private final LivraisonRepository commandes;
    private final ServiceIa ia;

    public record Promesse(Instant heure, String source) { }

    /** A l'acceptation : preparation annoncee connue. Arrondie aux 5 minutes superieures (plus lisible pour le client). */
    public Promesse promesse(Livraison c, Instant maintenant) {
        Partenaire p = c.getPartenaire();
        int annonce = c.getTempsPreparationMinutes() == null ? 0 : c.getTempsPreparationMinutes();
        double vitesse = vitesse(p);
        double km = p == null || p.getLatitude() == null ? 0
                : Distances.km(p.getLatitude(), p.getLongitude(), c.getLatitude(), c.getLongitude()) * EstimationArrivee.FACTEUR_DETOUR;
        ZonedDateTime local = maintenant.atZone(MessagesStatut.FUSEAU);
        Optional<ServiceIa.PredictionEta> prediction = ia.predireEta(new ServiceIa.CaracteristiquesEta(p == null ? null : p.getId(), annonce,
                Math.round(km * 1000) / 1000.0, vitesse, local.getHour(), local.getDayOfWeek().getValue(), 1));
        double preparationMin = prediction.map(ServiceIa.PredictionEta::preparationMin).orElseGet(() -> annonce * ponctualite(p));
        double trajetMin = prediction.map(ServiceIa.PredictionEta::trajetMin).orElseGet(() -> km / vitesse * 60);

        Duration preparation = minutes(preparationMin);
        Duration brut = (preparation.compareTo(APPROCHE_COURSIER) > 0 ? preparation : APPROCHE_COURSIER)
                .plus(EstimationArrivee.TEMPS_COLLECTE).plus(minutes(trajetMin));
        Duration marge = Duration.ofSeconds(Math.round(brut.getSeconds() * MARGE));
        if (marge.compareTo(MARGE_MIN) < 0) marge = MARGE_MIN;
        return new Promesse(arrondir5(maintenant.plus(brut).plus(marge)), prediction.isPresent() ? IA : REGLES);
    }

    /**
     * Ratio preparation reelle / annoncee du commerce sur ses dernieres commandes pretes, borne.
     * Sans historique : 1 (on croit l'annonce).
     */
    double ponctualite(Partenaire p) {
        if (p == null || p.getId() == null) return 1;
        List<Livraison> recentes = commandes.findTop20ByPartenaireIdAndPreteLeIsNotNullAndAccepteeLeIsNotNullOrderByPreteLeDesc(p.getId());
        if (recentes == null) return 1;
        double somme = 0;
        int n = 0;
        for (Livraison l : recentes) {
            Integer annonce = l.getTempsPreparationMinutes();
            if (annonce == null || annonce <= 0) continue;
            somme += Duration.between(l.getAccepteeLe(), l.getPreteLe()).toSeconds() / 60.0 / annonce;
            n++;
        }
        if (n == 0) return 1;
        return Math.max(RATIO_MIN, Math.min(RATIO_MAX, somme / n));
    }

    /** ETA actualisee (suivi client et positions diffusees) ; null si la commande n'est pas en cours de livraison. */
    public Instant arrivee(Livraison c, Instant maintenant) {
        Partenaire p = c.getPartenaire();
        if (p == null || p.getLatitude() == null || p.getLongitude() == null) return null;
        Optional<Instant> parLot = arriveeDansLot(c, maintenant);
        if (parLot.isPresent()) return parLot.get();

        Livreur livreur = c.getLivreur();
        Point positionLivreur = livreur != null && livreur.positionConnue()
                ? new Point(livreur.getDerniereLatitude(), livreur.getDerniereLongitude()) : null;
        return EstimationArrivee.heure(c.getStatut(), maintenant, finDePreparation(c), new Point(p.getLatitude(), p.getLongitude()),
                new Point(c.getLatitude(), c.getLongitude()), positionLivreur, vitesse(p)).orElse(null);
    }

    /** Commande deja prete : l'heure reelle ; sinon l'annonce corrigee par la ponctualite du commerce (preparation predite). */
    Instant finDePreparation(Livraison c) {
        if (c.getPreteLe() != null) return c.getPreteLe();
        Instant annoncee = c.heurePretePrevue();
        if (annoncee == null || c.getAccepteeLe() == null || c.getTempsPreparationMinutes() == null) return annoncee;
        double ratio = ponctualite(c.getPartenaire());
        if (ratio <= 1) return annoncee;
        Instant predite = c.getAccepteeLe().plusSeconds(Math.round(c.getTempsPreparationMinutes() * 60 * ratio));
        return predite.isAfter(annoncee) ? predite : annoncee;
    }

    /** Lot accepte de plusieurs commandes : temps restant le long de la meilleure tournee depuis la position du coursier. */
    Optional<Instant> arriveeDansLot(Livraison c, Instant maintenant) {
        Lot lot = c.getLot();
        Livreur livreur = c.getLivreur();
        if (lot == null || lot.getStatut() != StatutLot.ACCEPTE || livreur == null || !livreur.positionConnue()
                || !AffectationMissionService.MISSIONS_EN_COURS.contains(c.getStatut()))
            return Optional.empty();
        List<Course> courses = commandes.findAllByLotIdOrderByIdAsc(lot.getId()).stream()
                .filter(l -> AffectationMissionService.MISSIONS_EN_COURS.contains(l.getStatut()) && l.getPartenaire() != null
                        && l.getPartenaire().getLatitude() != null && l.getLivreur() != null && l.getLivreur().getId().equals(livreur.getId()))
                .map(l -> new Course(l.getId(), new Point(l.getPartenaire().getLatitude(), l.getPartenaire().getLongitude()),
                        new Point(l.getLatitude(), l.getLongitude()), AffectationMissionService.EN_ROUTE_VERS_CLIENT.contains(l.getStatut())))
                .toList();
        if (courses.size() < 2 || courses.stream().noneMatch(k -> k.commandeId().equals(c.getId()))) return Optional.empty();
        Point depart = new Point(livreur.getDerniereLatitude(), livreur.getDerniereLongitude());
        return Itineraire.optimiser(depart, courses, vitesse(c.getPartenaire()), null)
                .flatMap(r -> r.livraison(c.getId())).map(maintenant::plus);
    }

    static double vitesse(Partenaire p) {
        return p == null || p.getZone() == null ? Zone.VITESSE_PAR_DEFAUT_KMH : p.getZone().vitesseMoyenne();
    }

    static Duration minutes(double minutes) {
        return Duration.ofSeconds(Math.round(Math.max(0, minutes) * 60));
    }

    static Instant arrondir5(Instant heure) {
        Instant minute = heure.truncatedTo(ChronoUnit.MINUTES);
        if (minute.isBefore(heure)) minute = minute.plus(1, ChronoUnit.MINUTES);
        long reste = minute.getEpochSecond() / 60 % 5;
        return reste == 0 ? minute : minute.plus(5 - reste, ChronoUnit.MINUTES);
    }
}
