package com.fleetpulse.livraison.Model;

import jakarta.persistence.*;
import lombok.*;

@Entity @Getter @Setter @NoArgsConstructor
public class AdresseLivraison {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(optional = false) private Client client;
    @Column(nullable = false, length = 80) private String libelle;
    @Column(nullable = false, length = 250) private String adresse;
    private double latitude, longitude;
}
