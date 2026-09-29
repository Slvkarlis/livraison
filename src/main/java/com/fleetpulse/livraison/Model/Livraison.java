package com.fleetpulse.livraison.Model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import com.fleetpulse.livraison.Model.enums.*;

@Entity @Getter @Setter @NoArgsConstructor
public class Livraison {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false, unique = true) private String codeSuivi;   // reference de la commande
    @Column(nullable = false) private String adresse;
    @Column(nullable = false) private Double latitude;    // position GPS du lieu de livraison
    @Column(nullable = false) private Double longitude;
    @Column(nullable = false) private Instant creneauDebut;
    @Column(nullable = false) private Instant creneauFin;
    @Enumerated(EnumType.STRING) private StatutLivraison statut = StatutLivraison.EN_PREPARATION;
    @Enumerated(EnumType.STRING) private ModePaiement modePaiement = ModePaiement.COD;
    private double montantACollecter;
    private Instant dateCreation = Instant.now();

    @ManyToOne(optional = false) private Client client;
}
