package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.MarketplaceDto.Position;
import com.fleetpulse.livraison.Dto.SuiviDto.*;
import com.fleetpulse.livraison.Model.Livraison;
import com.fleetpulse.livraison.Model.Livreur;
import com.fleetpulse.livraison.Model.Partenaire;
import com.fleetpulse.livraison.Model.Zone;
import com.fleetpulse.livraison.Repository.LivraisonRepository;
import com.fleetpulse.livraison.Service.EstimationArrivee.Point;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** US-302 / US-303 : le client suit sa commande (statut, coursier sur la carte, heure d'arrivee estimee). */
@Service @RequiredArgsConstructor @Transactional(readOnly = true)
public class SuiviCommandeService {
    private final LivraisonRepository commandes;

    /** Commande d'un autre client : 404. */
    public SuiviCommandeVue suivi(String email, Long id) {
        Livraison c = commandes.findById(id).filter(l -> l.getClient().getEmail().equals(email)).orElseThrow(MarketplaceException::absent);
        return vue(c);
    }

    SuiviCommandeVue vue(Livraison c) {
        Partenaire p = c.getPartenaire();
        Livreur livreur = c.getLivreur();
        boolean visible = livreur != null && livreur.positionConnue()
                && AffectationMissionService.EN_ROUTE_VERS_CLIENT.contains(c.getStatut());
        return new SuiviCommandeVue(c.getId(), c.getStatut(), livreur == null ? null : livreur.getPrenom(),
                visible ? new PositionLivreurVue(livreur.getDerniereLatitude(), livreur.getDerniereLongitude(), livreur.getDernierePositionLe()) : null,
                p == null || p.getLatitude() == null ? null : new Position(p.getLatitude(), p.getLongitude()),
                new Position(c.getLatitude(), c.getLongitude()), c.heurePretePrevue(), arriveeEstimee(c, Instant.now()));
    }

    /** ETA par regles (EstimationArrivee) avec la vitesse moyenne de la zone du commerce. */
    Instant arriveeEstimee(Livraison c, Instant maintenant) {
        Partenaire p = c.getPartenaire();
        if (p == null || p.getLatitude() == null || p.getLongitude() == null) return null;
        Zone zone = p.getZone();
        Livreur livreur = c.getLivreur();
        Point positionLivreur = livreur != null && livreur.positionConnue()
                ? new Point(livreur.getDerniereLatitude(), livreur.getDerniereLongitude()) : null;
        // Commande deja prete (parfois avant l'heure annoncee) : c'est l'heure reelle qui compte
        Instant prete = c.getPreteLe() != null ? c.getPreteLe() : c.heurePretePrevue();
        return EstimationArrivee.heure(c.getStatut(), maintenant, prete, new Point(p.getLatitude(), p.getLongitude()),
                new Point(c.getLatitude(), c.getLongitude()), positionLivreur,
                zone == null ? Zone.VITESSE_PAR_DEFAUT_KMH : zone.vitesseMoyenne()).orElse(null);
    }
}
