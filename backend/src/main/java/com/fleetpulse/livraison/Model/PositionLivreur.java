package com.fleetpulse.livraison.Model;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.*;
import org.hibernate.annotations.Immutable;

/**
 * US-301 : point GPS recu d'un coursier pendant ses missions. Jamais modifie : alimente le suivi
 * et, au Sprint 4, l'entrepot de donnees (traces GPS). Archivage des anciens points : a definir (cahier des charges §4.3).
 */
@Entity @Immutable @Getter @NoArgsConstructor
@Table(indexes = @Index(name = "idx_position_livreur_date", columnList = "livreur_id,date"))
public class PositionLivreur {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(optional = false, fetch = FetchType.LAZY) private Livreur livreur;
    @Column(nullable = false) private double latitude;
    @Column(nullable = false) private double longitude;
    private Double precisionMetres;     // rayon d'incertitude annonce par le telephone
    @Column(nullable = false) private Instant date;

    public PositionLivreur(Livreur livreur, double latitude, double longitude, Double precisionMetres, Instant date) {
        this.livreur = livreur;
        this.latitude = latitude;
        this.longitude = longitude;
        this.precisionMetres = precisionMetres;
        this.date = date;
    }
}
