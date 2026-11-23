package com.fleetpulse.livraison.Model;

import com.fleetpulse.livraison.Model.enums.ImputationLitige;
import com.fleetpulse.livraison.Model.enums.StatutReclamation;
import com.fleetpulse.livraison.Model.enums.TypeReclamation;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** Reclamation d'un client sur une commande livree (US-516) et sa decision (US-517). Une seule par commande. */
@Entity @Getter @NoArgsConstructor
@Table(name = "reclamation", uniqueConstraints = @UniqueConstraint(name = "uk_reclamation_commande", columnNames = "commande_id"))
public class Reclamation {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(optional = false) private Livraison commande;
    @Enumerated(EnumType.STRING) @Column(nullable = false, columnDefinition = "varchar(30)") private TypeReclamation type;
    @Column(nullable = false, length = 500) private String description;
    @Column(precision = 14, scale = 3) private BigDecimal montantDemande;
    @Enumerated(EnumType.STRING) @Column(nullable = false, columnDefinition = "varchar(20)") private StatutReclamation statut = StatutReclamation.OUVERTE;
    @Column(nullable = false) private Instant creeeLe = Instant.now();

    @Column(precision = 14, scale = 3) private BigDecimal montantRembourse;
    @Enumerated(EnumType.STRING) @Column(columnDefinition = "varchar(20)") private ImputationLitige imputation;
    @Column(length = 300) private String commentaireDecision;
    private Instant decideeLe;
    private String decidePar;

    public Reclamation(Livraison commande, TypeReclamation type, String description, BigDecimal montantDemande) {
        this.commande = commande;
        this.type = type;
        this.description = description;
        this.montantDemande = montantDemande;
    }

    public void decider(StatutReclamation statut, BigDecimal montant, ImputationLitige imputation, String commentaire, String par, Instant quand) {
        this.statut = statut;
        this.montantRembourse = montant;
        this.imputation = imputation;
        this.commentaireDecision = commentaire;
        this.decidePar = par;
        this.decideeLe = quand;
    }
}
