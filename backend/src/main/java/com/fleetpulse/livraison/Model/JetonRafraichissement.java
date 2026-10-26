package com.fleetpulse.livraison.Model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

/** Jeton de rafraichissement (US-102) : a usage unique, renouvele a chaque utilisation, revoque a la deconnexion. */
@Entity @Getter @Setter @NoArgsConstructor
public class JetonRafraichissement {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(optional = false) private Utilisateur utilisateur;
    @Column(nullable = false, unique = true, length = 64) private String jetonHash;  // SHA-256, jamais en clair
    @Column(nullable = false) private Instant expireLe;
    private boolean revoque;
    @Column(nullable = false) private Instant creeLe = Instant.now();
}
