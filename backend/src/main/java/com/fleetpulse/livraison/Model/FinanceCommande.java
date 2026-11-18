package com.fleetpulse.livraison.Model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import lombok.*;

/**
 * Sprint 5 : suivi financier d'une commande livree, cree une seule fois a la livraison (contrainte d'unicite :
 * comptabilisation idempotente). Les montants sont figes ; seuls les rattachements au depot de cash (US-505)
 * et aux closings (US-506, US-512) evoluent.
 */
@Entity @Getter @Setter @NoArgsConstructor
@Table(indexes = { @Index(name = "idx_finance_livreur_depot", columnList = "livreur_id,depot_id"), @Index(name = "idx_finance_livree", columnList = "livreeLe"),
        @Index(name = "idx_bi_finance_zone", columnList = "zoneId,livreeLe"), @Index(name = "idx_bi_finance_partenaire", columnList = "partenaire_id,livreeLe") })
public class FinanceCommande {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @OneToOne(optional = false) @JoinColumn(name = "commande_id", unique = true) private Livraison commande;
    @ManyToOne private Partenaire partenaire;
    @ManyToOne private Livreur livreur;
    private Long zoneId;
    @Column(nullable = false, precision = 14, scale = 3) private BigDecimal montantArticles;
    @Column(nullable = false, precision = 5, scale = 2) private BigDecimal tauxCommission;   // en %, fige a la livraison
    @Column(nullable = false, precision = 14, scale = 3) private BigDecimal commission;
    @Column(nullable = false, precision = 14, scale = 3) private BigDecimal netPartenaire;
    @Column(nullable = false, precision = 14, scale = 3) private BigDecimal fraisLivraison;
    @Column(nullable = false, precision = 14, scale = 3) private BigDecimal montantEncaisse;   // especes detenues par le coursier
    @Column(nullable = false, precision = 14, scale = 3) private BigDecimal ecartEncaissement;
    @Column(nullable = false, precision = 14, scale = 3) private BigDecimal remunerationCoursier;
    private double distanceKm;
    @Column(nullable = false) private Instant livreeLe;
    @Column(nullable = false) private Instant comptabiliseLe;
    @ManyToOne private DepotCash depot;             // US-505 : cash rapproche
    @ManyToOne private Closing closingPartenaire;   // US-506 : net reverse au commerce
    @ManyToOne private Closing closingCoursier;     // US-512 : mission payee au coursier
}
