package com.fleetpulse.livraison.Model;

import com.fleetpulse.livraison.Model.enums.StatutDepot;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import lombok.*;

/** US-505 : depot du cash d'un coursier au responsable FINANCE, avec son recu ; rapproche des commandes encaissees. */
@Entity @Getter @Setter @NoArgsConstructor
public class DepotCash {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(unique = true, length = 30) private String numeroRecu;
    @ManyToOne(optional = false) private Livreur livreur;
    @Column(nullable = false, precision = 14, scale = 3) private BigDecimal montantAttendu;   // solde du coursier au depot
    @Column(nullable = false, precision = 14, scale = 3) private BigDecimal montantRecu;
    @Column(nullable = false, precision = 14, scale = 3) private BigDecimal ecart;             // recu - attendu
    @Column(length = 300) private String motifEcart;
    @Enumerated(EnumType.STRING) @Column(nullable = false, columnDefinition = "varchar(20)") private StatutDepot statut;
    private int nbCommandes;
    @Column(nullable = false) private Instant date;
    @Column(nullable = false) private String enregistrePar;
    @Column(unique = true, length = 80) private String cleIdempotence;
}
