package com.fleetpulse.livraison.Model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

@Entity @Getter @Setter @NoArgsConstructor
public class Produit {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(optional = false) private Partenaire partenaire;
    @Column(nullable = false, length = 120) private String nom;
    @Column(nullable = false, precision = 14, scale = 3) private BigDecimal prix;
    private boolean disponible = true;
}
