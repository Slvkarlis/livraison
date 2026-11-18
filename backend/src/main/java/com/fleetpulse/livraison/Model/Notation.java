package com.fleetpulse.livraison.Model;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.*;
import org.hibernate.annotations.Immutable;

/** Une cible réelle de la commande ; aucune cible polymorphe sans clé étrangère. */
@Entity @Immutable @Getter @NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(uniqueConstraints = @UniqueConstraint(name = "uk_notation_participant", columnNames = {"commande_id", "auteur_id", "cible_id"}),
        indexes = @Index(name = "idx_notation_cible_date", columnList = "cible_id,date"))
public class Notation {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false) private int note;
    @Column(length = 500) private String commentaire;
    @ManyToOne(optional = false, fetch = FetchType.LAZY) private Utilisateur auteur;
    @ManyToOne(optional = false, fetch = FetchType.LAZY) private Utilisateur cible;
    @ManyToOne(optional = false, fetch = FetchType.LAZY) private Livraison commande;
    @Column(nullable = false) private Instant date;

    public Notation(int note, String commentaire, Utilisateur auteur, Utilisateur cible, Livraison commande, Instant date) {
        this.note = note; this.commentaire = commentaire; this.auteur = auteur; this.cible = cible;
        this.commande = commande; this.date = date;
    }
}
