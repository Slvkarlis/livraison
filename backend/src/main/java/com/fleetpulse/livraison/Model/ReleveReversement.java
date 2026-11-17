package com.fleetpulse.livraison.Model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import lombok.*;

/** US-506 : releve de reversement d'un partenaire pour un closing (commandes a cash rapproche uniquement). */
@Entity @Getter @Setter @NoArgsConstructor
@Table(uniqueConstraints = @UniqueConstraint(name = "uk_releve_partenaire", columnNames = { "closing_id", "partenaire_id" }))
public class ReleveReversement {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(optional = false) private Closing closing;
    @ManyToOne(optional = false) private Partenaire partenaire;
    private int nbCommandes;
    @Column(nullable = false, precision = 14, scale = 3) private BigDecimal ventes;       // GMV
    @Column(nullable = false, precision = 14, scale = 3) private BigDecimal commission;
    @Column(nullable = false, precision = 14, scale = 3) private BigDecimal net;          // a reverser
}
