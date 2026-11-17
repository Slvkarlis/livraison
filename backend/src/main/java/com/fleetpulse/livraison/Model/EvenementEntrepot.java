package com.fleetpulse.livraison.Model;

import com.fleetpulse.livraison.Model.enums.TypeEvenement;
import jakarta.persistence.*;
import java.time.Instant;
import lombok.*;
import org.hibernate.annotations.Immutable;

/**
 * US-401 : evenement historise dans l'entrepot de donnees (jamais modifie), source d'entrainement des modeles d'IA
 * (preparation reelle vs annoncee, offres acceptees ou refusees, affectations, changements de statut).
 */
@Entity @Immutable @Getter @NoArgsConstructor
@Table(indexes = { @Index(name = "idx_entrepot_date", columnList = "date"), @Index(name = "idx_entrepot_type", columnList = "type,date") })
public class EvenementEntrepot {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Enumerated(EnumType.STRING) @Column(nullable = false, columnDefinition = "varchar(20)") private TypeEvenement type;
    @Column(nullable = false) private Instant date;
    private Long commandeId;
    private Long livreurId;
    private Long zoneId;
    private Long lotId;
    private Double valeur;                    // mesure principale : minutes de preparation, score de l'offre...
    @Column(length = 60) private String code;   // statut, decision de l'offre...
    @Column(length = 500) private String details;

    public EvenementEntrepot(TypeEvenement type, Instant date, Long commandeId, Long livreurId, Long zoneId, Long lotId,
                             Double valeur, String code, String details) {
        this.type = type;
        this.date = date;
        this.commandeId = commandeId;
        this.livreurId = livreurId;
        this.zoneId = zoneId;
        this.lotId = lotId;
        this.valeur = valeur;
        this.code = code;
        this.details = details == null || details.length() <= 500 ? details : details.substring(0, 500);
    }
}
