package com.fleetpulse.livraison.Model;

import com.fleetpulse.livraison.Model.enums.TypeAffectation;
import jakarta.persistence.*;
import java.time.Instant;
import lombok.*;

/** US-2B11 : zone ou un coursier est autorise a travailler (une affectation par couple coursier / zone). */
@Entity @Getter @Setter @NoArgsConstructor
@Table(uniqueConstraints = @UniqueConstraint(name = "uk_affectation_livreur_zone", columnNames = { "livreur_id", "zone_id" }))
public class AffectationZone {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(optional = false) private Livreur livreur;
    @ManyToOne(optional = false) private Zone zone;
    @Enumerated(EnumType.STRING) @Column(nullable = false, columnDefinition = "varchar(20)") private TypeAffectation type;
    private Instant debut;   // TEMPORAIRE uniquement
    private Instant fin;     // TEMPORAIRE uniquement (exclue)
    private Instant dateCreation = Instant.now();

    /** Une affectation temporaire n'autorise le coursier qu'entre debut (inclus) et fin (exclue). */
    public boolean enVigueur(Instant instant) {
        if (type != TypeAffectation.TEMPORAIRE) return true;
        return !instant.isBefore(debut) && instant.isBefore(fin);
    }
}
