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
    @Enumerated(EnumType.STRING) @Column(columnDefinition = "varchar(30)")
    private StatutLivraison statut = StatutLivraison.EN_PREPARATION;
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
    @ManyToOne private Partenaire partenaire;
    private String nomPartenaire;
    private String nomZone;
    @Column(precision = 14, scale = 3) private java.math.BigDecimal montantArticles;
    @Column(precision = 14, scale = 3) private java.math.BigDecimal total;
    @Column(length = 500) private String notes;
    @Column(unique = true, length = 180) private String cleIdempotence;
    private String empreinteRequete;
    // Sprint 2 bis : decision du partenaire (US-2B2)
    private Integer tempsPreparationMinutes;
    private Instant accepteeLe;
    @Enumerated(EnumType.STRING) @Column(columnDefinition = "varchar(30)") private MotifRefus motifRefus;
    @Column(length = 300) private String commentaireRefus;
    @OneToMany(mappedBy = "commande", cascade = CascadeType.ALL, orphanRemoval = true)
    private java.util.List<LigneCommande> lignes = new java.util.ArrayList<>();

    public java.math.BigDecimal calculerTotal() {
        montantArticles = lignes.stream().map(LigneCommande::getSousTotal)
                .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);
        total = montantArticles.add(java.math.BigDecimal.valueOf(fraisLivraison)).setScale(3);
        return total;
    }
}
