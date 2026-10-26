package com.fleetpulse.livraison.Model;

import jakarta.persistence.*;
import lombok.*;

@Entity @Getter @Setter @NoArgsConstructor
public class Livreur extends Utilisateur {
    @OneToOne @JoinColumn(name = "vehicule_id") private Vehicule vehicule;
    // Dossier de candidature (US-106)
    private String numeroIdentite;     // CIN ou passeport
    private String vehiculeDeclare;    // vehicule personnel declare par le candidat (type, immatriculation)
}
