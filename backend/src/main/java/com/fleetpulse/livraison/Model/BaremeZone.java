package com.fleetpulse.livraison.Model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import lombok.*;

/** US-512 : remuneration d'une mission dans la zone du commerce = base + prix par km (commerce -> client, detour compris). */
@Entity @Getter @Setter @NoArgsConstructor
public class BaremeZone {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @OneToOne(optional = false) @JoinColumn(name = "zone_id", unique = true) private Zone zone;
    @Column(nullable = false, precision = 14, scale = 3) private BigDecimal base;
    @Column(nullable = false, precision = 14, scale = 3) private BigDecimal parKm;
    private Instant modifieLe;
    private String modifiePar;
}
