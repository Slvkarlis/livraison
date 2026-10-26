package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Config.DepotProperties;
import com.fleetpulse.livraison.Config.TarificationProperties;
import com.fleetpulse.livraison.Model.enums.TypeLivraison;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Frais de livraison payes par le client, calcules par le systeme (jamais saisis par le client) :
 * cout de revient du trajet depot -> client (remuneration livreur + carburant) majore d'une marge beneficiaire.
 * Une livraison immediate coute plus cher ; un creneau planifie garde le tarif normal.
 */
@Service
public class TarificationService {
    private static final double RAYON_TERRE_KM = 6371.0088;

    @Autowired
    private TarificationProperties props;
    @Autowired
    private DepotProperties depot;

    public record Devis(double distanceKm, double fraisLivraison, double supplementImmediat, double total) {
    }

    public Devis devis(double latitude, double longitude, TypeLivraison type) {
        double distanceKm = distanceRouteKm(depot.latitude(), depot.longitude(), latitude, longitude);
        if (distanceKm > props.distanceMaxKm()) {
            throw new IllegalArgumentException("Adresse hors zone : nous livrons jusqu'à "
                    + Math.round(props.distanceMaxKm()) + " km du dépôt.");
        }
        double carburant = distanceKm * props.consommationReference() / 100 * props.prixCarburantLitre();
        double coutDeRevient = props.remunerationBase() + props.remunerationParKm() * distanceKm + carburant;
        double frais = arrondir(Math.max(props.fraisMinimum(), coutDeRevient * (1 + props.margeBeneficiaire())));
        double total = type == TypeLivraison.IMMEDIATE ? arrondir(frais * (1 + props.majorationImmediate())) : frais;
        return new Devis(distanceKm, frais, arrondir(total - frais), total);
    }

    /**
     * Distance "a vol d'oiseau" (Haversine) multipliee par un facteur de detour routier.
     * Pourra etre remplacee plus tard par un vrai calcul d'itineraire (OSRM).
     */
    public double distanceRouteKm(double fromLatitude, double fromLongitude, double toLatitude, double toLongitude) {
        double latitudeDifference = Math.toRadians(toLatitude - fromLatitude);
        double longitudeDifference = Math.toRadians(toLongitude - fromLongitude);
        double haversine = Math.pow(Math.sin(latitudeDifference / 2), 2)
                + Math.cos(Math.toRadians(fromLatitude))
                * Math.cos(Math.toRadians(toLatitude))
                * Math.pow(Math.sin(longitudeDifference / 2), 2);
        double volOiseau = RAYON_TERRE_KM * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
        return Math.round(volOiseau * props.facteurRoute() * 100) / 100.0;
    }

    /** Arrondi aux 100 millimes (0,1 DT), comme les prix affiches en Tunisie. */
    private double arrondir(double montant) {
        return Math.round(montant * 10) / 10.0;
    }
}
