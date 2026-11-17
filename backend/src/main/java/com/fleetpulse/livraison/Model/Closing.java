package com.fleetpulse.livraison.Model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import lombok.*;

/** US-506 / US-512 : closing hebdomadaire (du lundi 00:00 au lundi suivant, heure de Tunisie), un seul par semaine. */
@Entity @Getter @Setter @NoArgsConstructor
public class Closing {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false, unique = true) private LocalDate semaine;   // lundi
    @Column(nullable = false) private Instant debut;
    @Column(nullable = false) private Instant fin;
    @Column(nullable = false) private Instant valideLe;
    @Column(nullable = false) private String validePar;
    @Column(nullable = false, precision = 14, scale = 3) private BigDecimal totalReversements;
    @Column(nullable = false, precision = 14, scale = 3) private BigDecimal totalRemunerations;
    private int nbCommandesPartenaires;
    private int nbMissions;
}
