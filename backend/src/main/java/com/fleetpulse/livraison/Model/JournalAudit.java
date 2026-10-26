package com.fleetpulse.livraison.Model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import com.fleetpulse.livraison.Model.enums.ActionAudit;
import org.hibernate.annotations.Immutable;

/** Entree du journal d'audit (US-108) : jamais modifiee ni supprimee. */
@Entity @Immutable @Getter @NoArgsConstructor
public class JournalAudit {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false) private Instant date;
    @Column(nullable = false) private String acteur;     // email de l'auteur, ou "anonyme"
    @Enumerated(EnumType.STRING) @Column(nullable = false, columnDefinition = "varchar(40)") private ActionAudit action;
    private String cibleType;
    private Long cibleId;
    @Column(length = 1000) private String details;

    public JournalAudit(String acteur, ActionAudit action, String cibleType, Long cibleId, String details) {
        this.date = Instant.now();
        this.acteur = acteur;
        this.action = action;
        this.cibleType = cibleType;
        this.cibleId = cibleId;
        this.details = details;
    }
}
