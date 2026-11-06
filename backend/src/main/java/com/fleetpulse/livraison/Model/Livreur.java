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

    public boolean estDisponible() { return Boolean.TRUE.equals(disponible) && isActif(); }
}
