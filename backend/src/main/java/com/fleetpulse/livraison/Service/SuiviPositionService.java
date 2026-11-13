package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.EspaceLivreurDto.PositionRequest;
import com.fleetpulse.livraison.Dto.EspaceLivreurDto.PositionVue;
import com.fleetpulse.livraison.Dto.SuiviDto.PositionCommande;
import com.fleetpulse.livraison.Model.Livraison;
import com.fleetpulse.livraison.Model.Livreur;
import com.fleetpulse.livraison.Model.PositionLivreur;
import com.fleetpulse.livraison.Model.enums.StatutLivraison;
import com.fleetpulse.livraison.Repository.LivraisonRepository;
import com.fleetpulse.livraison.Repository.LivreurRepository;
import com.fleetpulse.livraison.Repository.PositionLivreurRepository;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * US-301 : positions GPS envoyees par l'application coursier pendant ses missions.
 *
 * <p>Les points aberrants sont ecartes (risque « imprecision GPS en milieu urbain », cahier des charges §7.3) :
 * precision annoncee trop faible, ou deplacement impossible depuis le point precedent.
 * La derniere position est toujours gardee sur le coursier ; l'historique n'est ecrit que pendant une mission.
 *
 * <p>US-302 : chaque position retenue est poussee aux clients dont le colis est a bord, avec l'ETA actualisee ;
 * a moins de {@link #SEUIL_PROXIMITE_KM} du client, la commande passe une seule fois a A_PROXIMITE.
 */
@Service @RequiredArgsConstructor @Transactional
public class SuiviPositionService {
    /** Au-dela, le point ne permet pas de situer le coursier dans la bonne rue. */
    static final double PRECISION_MAX_METRES = 150;
    /** Vitesse impliquee par deux points successifs au-dela de laquelle le second est un saut GPS. */
    static final double VITESSE_MAX_KMH = 150;
    /** Distance au client a partir de laquelle il est prevenu que le coursier arrive. */
    static final double SEUIL_PROXIMITE_KM = 0.3;

    private final LivreurRepository livreurs;
    private final LivraisonRepository commandes;
    private final PositionLivreurRepository positions;
    private final SuiviCommandeService suiviCommandes;
    private final CommandeWorkflow workflow;
    private final ApplicationEventPublisher evenements;

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
        if (enMission) {
            positions.save(new PositionLivreur(livreur, r.latitude(), r.longitude(), r.precision(), maintenant));
            informerClients(livreur, maintenant);
        }
        return new PositionVue(true, null, maintenant, enMission);
    }

    private void informerClients(Livreur livreur, Instant maintenant) {
        for (Livraison c : commandes.findAllByLivreurIdAndStatutInOrderByAffecteeLeAsc(livreur.getId(), AffectationMissionService.EN_ROUTE_VERS_CLIENT)) {
            Livraison commande = commandes.verrouiller(c.getId()).orElseThrow();
            if (!AffectationMissionService.EN_ROUTE_VERS_CLIENT.contains(commande.getStatut())) continue;
            double km = Distances.km(livreur.getDerniereLatitude(), livreur.getDerniereLongitude(), commande.getLatitude(), commande.getLongitude());
            // Une seule transition : pas d'alerte repetee a chaque point dans le rayon (cahier des charges §4.3)
            if (commande.getStatut() == StatutLivraison.RECUPEREE && km <= SEUIL_PROXIMITE_KM)
                workflow.transition(commande, StatutLivraison.A_PROXIMITE, livreur, "Livreur à moins de " + Math.round(SEUIL_PROXIMITE_KM * 1000) + " m");
            evenements.publishEvent(new PositionDiffusee(commande.getClient().getEmail(), new PositionCommande(commande.getId(),
                    livreur.getDerniereLatitude(), livreur.getDerniereLongitude(), maintenant, suiviCommandes.arriveeEstimee(commande, maintenant))));
        }
    }

    /** Publie apres validation de la transaction par DiffusionTempsReel. */
    public record PositionDiffusee(String clientEmail, PositionCommande position) { }

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
