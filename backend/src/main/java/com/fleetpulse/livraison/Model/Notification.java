package com.fleetpulse.livraison.Model;

import com.fleetpulse.livraison.Model.enums.StatutLivraison;
import jakarta.persistence.*;
import java.time.Instant;
import lombok.*;

/** US-304 : notification recue par un utilisateur (boite de reception), ecrite avec le changement de statut. */
@Entity @Table(name = "notification_utilisateur", indexes = @Index(columnList = "destinataire_id, creeLe"))
@Getter @Setter @NoArgsConstructor
public class Notification {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) private Utilisateur destinataire;
    private Long commandeId;
    @Enumerated(EnumType.STRING) @Column(columnDefinition = "varchar(30)") private StatutLivraison statut;
    @Column(nullable = false, length = 120) private String titre;
    @Column(nullable = false, length = 400) private String message;
    @Column(nullable = false) private Instant creeLe;
    private Instant lueLe;

    public Notification(Utilisateur destinataire, Long commandeId, StatutLivraison statut, String titre, String message, Instant creeLe) {
        this.destinataire = destinataire;
        this.commandeId = commandeId;
        this.statut = statut;
        this.titre = titre;
        this.message = message;
        this.creeLe = creeLe;
    }
}
