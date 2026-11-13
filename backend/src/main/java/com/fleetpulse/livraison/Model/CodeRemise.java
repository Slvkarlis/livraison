package com.fleetpulse.livraison.Model;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.*;

/**
 * US-310 : code de secours a 6 chiffres envoye au client par SMS, pour valider la remise sans QR.
 * Table separee de la commande : les essais rates sont comptes dans leur propre transaction
 * pendant que la commande reste verrouillee par la remise.
 */
@Entity @Getter @Setter @NoArgsConstructor
public class CodeRemise {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false, unique = true) private Long commandeId;
    @Column(nullable = false) private String codeHash;   // BCrypt, jamais en clair
    private int tentatives;
    private int nbEnvois;
    private Instant dernierEnvoiLe;
}
