package com.fleetpulse.livraison.Model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import lombok.*;

/** US-512 : releve hebdomadaire de remuneration d'un coursier pour un closing. */
@Entity @Getter @Setter @NoArgsConstructor
@Table(uniqueConstraints = @UniqueConstraint(name = "uk_releve_coursier", columnNames = { "closing_id", "livreur_id" }))
public class ReleveCoursier {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(optional = false) private Closing closing;
    @ManyToOne(optional = false) private Livreur livreur;
    private int nbMissions;
    private double distanceKm;
    @Column(nullable = false, precision = 14, scale = 3) private BigDecimal remuneration;
}
