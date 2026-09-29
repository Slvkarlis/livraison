package com.fleetpulse.livraison.Model;

import jakarta.persistence.*;
import lombok.*;

@Entity @Getter @Setter @NoArgsConstructor
public class Livreur extends Utilisateur {
    @OneToOne @JoinColumn(name = "vehicule_id") private Vehicule vehicule;
}
