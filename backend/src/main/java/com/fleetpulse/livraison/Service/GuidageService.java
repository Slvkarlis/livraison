package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Model.Livraison;
import com.fleetpulse.livraison.Model.Livreur;
import com.fleetpulse.livraison.Model.enums.StatutLivraison;
import com.fleetpulse.livraison.Repository.LivraisonRepository;
import com.fleetpulse.livraison.Repository.LivreurRepository;
import com.fleetpulse.livraison.Service.EstimationArrivee.Point;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * US-307 : le coursier est guide vers le commerce (AFFECTEE), puis vers le client (RECUPEREE, A_PROXIMITE).
 * L'adresse du client n'est jamais revelee avant la collecte (regle de MissionVue).
 */
@Service @RequiredArgsConstructor @Transactional(readOnly = true)
public class GuidageService {
    static final double VITESSE_KMH = 20.0;

    public record Guidage(String phase, Long commandeId, String cible, double cibleLatitude, double cibleLongitude,
                          double distanceKm, double dureeMinutes, String source, List<List<Double>> geometrie) { }

    private final LivraisonRepository commandes;
    private final LivreurRepository livreurs;
    private final Routage routage;

    public Guidage guidage(String email, Long id) {
        Livreur livreur = livreurs.findByEmail(email).orElseThrow(MarketplaceException::absent);
        Livraison c = commandes.findById(id)
                .filter(x -> x.getLivreur() != null && x.getLivreur().getId().equals(livreur.getId()))
                .orElseThrow(MarketplaceException::absent);
        if (!livreur.positionConnue())
            throw MarketplaceException.conflit("Position inconnue : activez la localisation pour être guidé.");
        Point depart = new Point(livreur.getDerniereLatitude(), livreur.getDerniereLongitude());

        boolean versCommerce = c.getStatut() == StatutLivraison.AFFECTEE;
        if (!versCommerce && c.getStatut() != StatutLivraison.RECUPEREE && c.getStatut() != StatutLivraison.A_PROXIMITE)
            throw MarketplaceException.conflit("Aucun guidage pour une commande au statut " + c.getStatut() + ".");

        String cible = versCommerce ? c.getPartenaire().getNomCommerce() : "Client";
        double lat = versCommerce ? c.getPartenaire().getLatitude() : c.getLatitude();
        double lng = versCommerce ? c.getPartenaire().getLongitude() : c.getLongitude();
        Routage.Trajet t = routage.trajet(depart, new Point(lat, lng), VITESSE_KMH);
        return new Guidage(versCommerce ? "COLLECTE" : "LIVRAISON", c.getId(), cible, lat, lng,
                t.distanceKm(), t.dureeMinutes(), t.source(), t.geometrie());
    }
}
