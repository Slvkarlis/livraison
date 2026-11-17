package com.fleetpulse.livraison.Model;

import com.fleetpulse.livraison.Model.enums.PorteeCommission;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import lombok.*;

/** US-502 : taux de commission (en %) global, par categorie de commerce ou par partenaire. Un taux par portee et cible. */
@Entity @Getter @Setter @NoArgsConstructor
@Table(uniqueConstraints = @UniqueConstraint(name = "uk_taux_commission", columnNames = { "portee", "categorie", "partenaire_id" }))
public class TauxCommission {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Enumerated(EnumType.STRING) @Column(nullable = false, columnDefinition = "varchar(20)") private PorteeCommission portee;
    @Column(length = 60) private String categorie;           // CATEGORIE : en minuscules
    @ManyToOne private Partenaire partenaire;                // PARTENAIRE
    @Column(nullable = false, precision = 5, scale = 2) private BigDecimal taux;
    private Instant modifieLe;
    private String modifiePar;
}
