package com.fleetpulse.livraison.Model;

import com.fleetpulse.livraison.Model.enums.StatutGroupeQuartier;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import lombok.*;

/** Le centre est privé : seuls les responsables peuvent consulter ses coordonnées. */
@Entity @Getter @Setter @NoArgsConstructor
@Table(indexes = @Index(name = "idx_quartier_commerce_statut", columnList = "commerce_id,statut,expiration"))
public class GroupeQuartier {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(optional = false) private Partenaire commerce;
    @ManyToOne(optional = false) private Zone zone;
    private double latitude, longitude, rayonMetres;
    @Column(nullable = false) private Instant ouverture;
    @Column(nullable = false) private Instant expiration;
    private Instant fermeture;
    @Enumerated(EnumType.STRING) @Column(nullable = false, columnDefinition = "varchar(20)")
    private StatutGroupeQuartier statut = StatutGroupeQuartier.OUVERT;
    @OneToMany(mappedBy = "groupeQuartier") @OrderBy("id ASC")
    private List<Livraison> commandes = new ArrayList<>();
    @OneToOne private Lot lot;
    private double gainKm;
    @Column(precision = 14, scale = 3) private BigDecimal gainDt = BigDecimal.ZERO.setScale(3);
    // Les taux sont figés à l'ouverture : une modification admin ne change pas une offre en cours.
    @Column(precision = 6, scale = 4) private BigDecimal reductionDeux;
    @Column(precision = 6, scale = 4) private BigDecimal reductionTrois;
}
