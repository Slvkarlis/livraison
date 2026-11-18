package com.fleetpulse.livraison.Model;

import com.fleetpulse.livraison.Model.enums.TypeAlerte;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import lombok.*;

/** Une ligne par objet/type ; elle est résolue puis réactivée, jamais dupliquée. */
@Entity @Getter @Setter @NoArgsConstructor
@Table(uniqueConstraints = @UniqueConstraint(name = "uk_alerte_objet", columnNames = {"type", "objetId"}),
        indexes = @Index(name = "idx_alerte_active", columnList = "type,active"))
public class Alerte {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 40) private TypeAlerte type;
    @Column(nullable = false) private Long objetId;
    @Column(nullable = false) private boolean active;
    @Column(nullable = false, precision = 14, scale = 3) private BigDecimal valeur;
    @Column(nullable = false, precision = 14, scale = 3) private BigDecimal seuil;
    @Column(nullable = false) private Instant declencheeLe;
    @Column(nullable = false) private Instant observeeLe;
    private Instant resolueLe;
}
