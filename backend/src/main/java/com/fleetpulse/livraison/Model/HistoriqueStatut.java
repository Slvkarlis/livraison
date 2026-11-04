package com.fleetpulse.livraison.Model;

import com.fleetpulse.livraison.Model.enums.Role;
import com.fleetpulse.livraison.Model.enums.StatutLivraison;
import jakarta.persistence.*;
import java.time.Instant;
import lombok.*;
import org.hibernate.annotations.Immutable;

/** Changement de statut d'une commande (qui, quand, de -> vers, motif) : jamais modifie ni supprime. */
@Entity @Immutable @Getter @NoArgsConstructor
@Table(indexes = @Index(name = "idx_historique_commande", columnList = "commande_id"))
public class HistoriqueStatut {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(optional = false) private Livraison commande;
    @Enumerated(EnumType.STRING) @Column(columnDefinition = "varchar(30)")
    private StatutLivraison ancien;                     // null a la creation de la commande
    @Enumerated(EnumType.STRING) @Column(nullable = false, columnDefinition = "varchar(30)")
    private StatutLivraison nouveau;
    @Column(nullable = false) private String acteur;    // email de l'auteur
    @Enumerated(EnumType.STRING) @Column(nullable = false, columnDefinition = "varchar(20)")
    private Role acteurRole;
    @Column(length = 500) private String motif;
    @Column(nullable = false) private Instant date;

    public HistoriqueStatut(Livraison commande, StatutLivraison ancien, StatutLivraison nouveau, Utilisateur acteur, String motif) {
        this.commande = commande;
        this.ancien = ancien;
        this.nouveau = nouveau;
        this.acteur = acteur.getEmail();
        this.acteurRole = acteur.getRole();
        this.motif = motif;
        this.date = Instant.now();
    }
}
