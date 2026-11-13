package com.fleetpulse.livraison.Service;

/** Distances a vol d'oiseau (MySQL sans PostGIS : calcul en Java, decision du 2026-11-03). */
public final class Distances {
    private static final double RAYON_TERRE_KM = 6371.0088;

    private Distances() { }

    /** Formule de haversine, en kilometres. */
    public static double km(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.pow(Math.sin(dLat / 2), 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.pow(Math.sin(dLng / 2), 2);
        return 2 * RAYON_TERRE_KM * Math.asin(Math.min(1, Math.sqrt(a)));
    }
}
