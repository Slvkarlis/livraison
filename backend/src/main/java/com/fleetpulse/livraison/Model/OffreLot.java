package com.fleetpulse.livraison.Model;

import com.fleetpulse.livraison.Model.enums.StatutOffre;
import jakarta.persistence.*;
import java.time.Instant;
import lombok.*;

/** US-405 : proposition d'un lot a un coursier, a accepter ou refuser avant expireLe. Un refus declenche une reproposition. */
@Entity @Getter @Setter @NoArgsConstructor
@Table(indexes = { @Index(name = "idx_offre_statut", columnList = "statut,expireLe"), @Index(name = "idx_offre_livreur", columnList = "livreur_id,statut") })
public class OffreLot {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(optional = false) private Lot lot;
    @ManyToOne(optional = false) private Livreur livreur;
    @Enumerated(EnumType.STRING) @Column(nullable = false, columnDefinition = "varchar(20)") private StatutOffre statut = StatutOffre.EN_ATTENTE;
    @Column(nullable = false) private Instant proposeeLe;
    @Column(nullable = false) private Instant expireLe;
    private Instant reponduLe;
    private boolean horsZone;              // coursier pris dans une zone voisine (debordement) : signale dans l'application
    private Double distanceLivreurKm;      // coursier -> premiere collecte, null si sa position est inconnue
    private double score;                  // plus petit = meilleur candidat (ChoixLivreur)
    @Column(length = 300) private String motifRefus;

    public OffreLot(Lot lot, Livreur livreur, Instant maintenant, Instant expireLe, boolean horsZone, Double distanceLivreurKm, double score) {
        this.lot = lot;
        this.livreur = livreur;
        this.proposeeLe = maintenant;
        this.expireLe = expireLe;
        this.horsZone = horsZone;
        this.distanceLivreurKm = distanceLivreurKm;
        this.score = score;
    }
}
