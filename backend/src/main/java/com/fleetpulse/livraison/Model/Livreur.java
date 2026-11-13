package com.fleetpulse.livraison.Model;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.*;

@Entity @Getter @Setter @NoArgsConstructor
public class Livreur extends Utilisateur {
    @OneToOne @JoinColumn(name = "vehicule_id") private Vehicule vehicule;
    // Dossier de candidature (US-106)
    private String numeroIdentite;     // CIN ou passeport
    private String vehiculeDeclare;    // vehicule personnel declare par le candidat (type, immatriculation)

    // US-2B8 : disponibilite declaree depuis une zone autorisee, avec la position du moment
    private Boolean disponible = false;
    private Double derniereLatitude;
    private Double derniereLongitude;
    private Instant disponibiliteMiseAJourLe;
    // US-301 : date de la derniere position connue (disponibilite ou suivi GPS pendant les missions)
    private Instant dernierePositionLe;

    public boolean estDisponible() { return Boolean.TRUE.equals(disponible) && isActif(); }

    public boolean positionConnue() { return derniereLatitude != null && derniereLongitude != null; }

    public void placer(double latitude, double longitude, Instant date) {
        derniereLatitude = latitude;
        derniereLongitude = longitude;
        dernierePositionLe = date;
    }
}
