package com.fleetpulse.livraison.Model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.*;

@Entity @Getter @Setter @NoArgsConstructor
public class Vehicule {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false, unique = true) private String immatriculation;
    private String type;          // moto, fourgonnette, ...
    private Double capaciteKg;
    @Column(nullable = false) private double consommationLitres100Km = 7.0;
    private boolean actif = true;
    @OneToOne(mappedBy = "vehicule") private Livreur livreur;
}
