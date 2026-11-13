package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.EspaceLivreurDto.PositionRequest;
import com.fleetpulse.livraison.Dto.EspaceLivreurDto.PositionVue;
import com.fleetpulse.livraison.Model.Livreur;
import com.fleetpulse.livraison.Model.PositionLivreur;
import com.fleetpulse.livraison.Repository.LivraisonRepository;
import com.fleetpulse.livraison.Repository.LivreurRepository;
import com.fleetpulse.livraison.Repository.PositionLivreurRepository;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * US-301 : positions GPS envoyees par l'application coursier pendant ses missions.
 *
 * <p>Les points aberrants sont ecartes (risque « imprecision GPS en milieu urbain », cahier des charges §7.3) :
 * precision annoncee trop faible, ou deplacement impossible depuis le point precedent.
 * La derniere position est toujours gardee sur le coursier ; l'historique n'est ecrit que pendant une mission.
 */
@Service @RequiredArgsConstructor @Transactional
public class SuiviPositionService {
    /** Au-dela, le point ne permet pas de situer le coursier dans la bonne rue. */
    static final double PRECISION_MAX_METRES = 150;
    /** Vitesse impliquee par deux points successifs au-dela de laquelle le second est un saut GPS. */
    static final double VITESSE_MAX_KMH = 150;

    private final LivreurRepository livreurs;
    private final LivraisonRepository commandes;
    private final PositionLivreurRepository positions;

    public PositionVue enregistrer(String email, PositionRequest r) {
        if (r == null) throw new IllegalArgumentException("Position obligatoire.");
        ZoneService.position(r.latitude(), r.longitude());
        if (r.precision() != null && (!Double.isFinite(r.precision()) || r.precision() < 0))
            throw new IllegalArgumentException("Précision invalide.");
        Livreur livreur = livreurs.findByEmail(email).orElseThrow(MarketplaceException::absent);
        Instant maintenant = Instant.now().truncatedTo(ChronoUnit.MICROS);
        boolean enMission = commandes.countByLivreurIdAndStatutIn(livreur.getId(), AffectationMissionService.MISSIONS_EN_COURS) > 0;

        String rejet = raisonDeRejet(livreur, r, maintenant);
        if (rejet != null) return new PositionVue(false, rejet, livreur.getDernierePositionLe(), enMission);

        livreur.placer(r.latitude(), r.longitude(), maintenant);
        if (enMission) positions.save(new PositionLivreur(livreur, r.latitude(), r.longitude(), r.precision(), maintenant));
        return new PositionVue(true, null, maintenant, enMission);
    }

    /** null : point retenu. */
    static String raisonDeRejet(Livreur precedent, PositionRequest r, Instant maintenant) {
        if (r.precision() != null && r.precision() > PRECISION_MAX_METRES)
            return "Position trop imprécise (" + Math.round(r.precision()) + " m).";
        if (!precedent.positionConnue() || precedent.getDernierePositionLe() == null) return null;
        double secondes = Duration.between(precedent.getDernierePositionLe(), maintenant).toMillis() / 1000.0;
        double km = Distances.km(precedent.getDerniereLatitude(), precedent.getDerniereLongitude(), r.latitude(), r.longitude());
        // Moins d'une seconde : vitesse non significative, seul un grand saut est ecarte
        double vitesse = km / Math.max(secondes, 1) * 3600;
        return vitesse > VITESSE_MAX_KMH ? "Déplacement incohérent ignoré." : null;
    }
}
