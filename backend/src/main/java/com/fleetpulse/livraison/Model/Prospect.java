package com.fleetpulse.livraison.Model;

import com.fleetpulse.livraison.Model.enums.StatutProspect;
import jakarta.persistence.*;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * Commerce potentiel a recruter (Sprint 8, US-801 a US-803).
 * Les champs de contexte (clientsZone, couverture, concurrents) sont figes a l'import : ce sont les entrees du modele.
 * Le modele n'est pas une decision : le responsable reste seul a contacter ou inscrire un commerce.
 */
@Entity @Getter @NoArgsConstructor
@Table(name = "prospect", indexes = @Index(name = "idx_prospect_statut", columnList = "statut"))
public class Prospect {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false, length = 120) private String nom;
    @Column(nullable = false, length = 40) private String categorie;
    @Column(length = 200) private String adresse;
    @Column(nullable = false) private Double latitude;
    @Column(nullable = false) private Double longitude;
    @Column(length = 60) private String source;                 // source autorisee citee par l'import
    @ManyToOne private Zone zone;
    private int clientsZone;
    private double couvertureZonePct;
    private int concurrentsProches;
    private double distanceClientsKm;
    @Enumerated(EnumType.STRING) @Column(nullable = false, columnDefinition = "varchar(20)") private StatutProspect statut = StatutProspect.A_CONTACTER;
    private Double score;                                        // 0 a 100, derniere evaluation
    @Column(length = 20) private String scoreModele;             // regle ou logistique
    private Instant statutLe = Instant.now();
    @Column(length = 300) private String commentaire;
    private Instant creeLe = Instant.now();

    public Prospect(String nom, String categorie, String adresse, double latitude, double longitude, String source, Zone zone) {
        this.nom = nom;
        this.categorie = categorie;
        this.adresse = adresse;
        this.latitude = latitude;
        this.longitude = longitude;
        this.source = source;
        this.zone = zone;
    }

    public void contexte(int clientsZone, double couvertureZonePct, int concurrentsProches, double distanceClientsKm) {
        this.clientsZone = clientsZone;
        this.couvertureZonePct = couvertureZonePct;
        this.concurrentsProches = concurrentsProches;
        this.distanceClientsKm = distanceClientsKm;
    }

    public void noterScore(double score, String modele) {
        this.score = score;
        this.scoreModele = modele;
    }

    public void changerStatut(StatutProspect nouveau, String commentaire, Instant quand) {
        this.statut = nouveau;
        this.statutLe = quand;
        if (commentaire != null) this.commentaire = commentaire;
    }
}
