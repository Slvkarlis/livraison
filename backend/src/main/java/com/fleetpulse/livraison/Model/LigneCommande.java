package com.fleetpulse.livraison.Model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

@Entity @Getter @Setter @NoArgsConstructor
public class LigneCommande {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(optional = false) private Livraison commande;
    @ManyToOne(optional = false) private Produit produit;
    @Column(nullable = false, length = 120) private String nomProduit;
    private int quantite;
    @Column(nullable = false, precision = 14, scale = 3) private BigDecimal prixUnitaire;
    @Column(nullable = false, precision = 14, scale = 3) private BigDecimal sousTotal;
}
