package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.MarketplaceDto.Position;
import com.fleetpulse.livraison.Dto.SuiviDto.*;
import com.fleetpulse.livraison.Model.Livraison;
import com.fleetpulse.livraison.Model.Livreur;
import com.fleetpulse.livraison.Model.Partenaire;
import com.fleetpulse.livraison.Repository.LivraisonRepository;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** US-302 / US-303 / US-406 : le client suit sa commande (statut, coursier sur la carte, ETA et promesse de livraison). */
@Service @RequiredArgsConstructor @Transactional(readOnly = true)
public class SuiviCommandeService {
    private final LivraisonRepository commandes;
    private final EstimationLivraisonService estimation;

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
                new Position(c.getLatitude(), c.getLongitude()), c.heurePretePrevue(), arriveeEstimee(c, Instant.now()),
                c.getPromesseLivraison(), c.getSourcePromesse());
    }

    /** US-406 : ETA actualisee (reste de l'itineraire du lot, preparation predite), voir EstimationLivraisonService. */
    Instant arriveeEstimee(Livraison c, Instant maintenant) {
        return estimation.arrivee(c, maintenant);
    }
}
