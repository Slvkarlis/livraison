package com.fleetpulse.livraison.Model;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.*;

/** US-304 : jeton Expo d'un telephone ; un jeton n'appartient qu'au dernier compte connecte sur ce telephone. */
@Entity @Getter @Setter @NoArgsConstructor
public class AppareilNotification {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) private Utilisateur utilisateur;
    @Column(nullable = false, unique = true, length = 200) private String jeton;
    @Column(nullable = false) private Instant majLe;
}
