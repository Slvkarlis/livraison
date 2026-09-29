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
    // varchar et non ENUM MySQL : ddl-auto=update n'ajoute jamais de nouvelle valeur a un ENUM
    @Enumerated(EnumType.STRING) @Column(columnDefinition = "varchar(20)")
    private ModePaiement modePaiement = ModePaiement.COD;
    @Enumerated(EnumType.STRING) @Column(columnDefinition = "varchar(20)")
    private StatutPaiement statutPaiement = StatutPaiement.A_LA_LIVRAISON;
    private String stripePaymentIntentId;
    @Enumerated(EnumType.STRING) @Column(columnDefinition = "varchar(20)")
    private TypeLivraison typeLivraison = TypeLivraison.PLANIFIEE;
    private double distanceKm;             // depot -> adresse, calculee par le systeme
    private double fraisLivraison;         // tarif normal (cout de revient + marge)
    private double supplementImmediat;     // 0 pour un creneau planifie
    private double montantACollecter;      // total paye au livreur (COD)
    private Instant dateCreation = Instant.now();

    @ManyToOne(optional = false) private Client client;
}
