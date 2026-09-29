package com.fleetpulse.livraison.Model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.*;
import com.fleetpulse.livraison.Model.enums.*;

@Entity @Inheritance(strategy = InheritanceType.JOINED)
@Getter @Setter @NoArgsConstructor
public abstract class Utilisateur {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    protected Long id;
    @Column(nullable = false) protected String nom;
    @Column(nullable = false) protected String prenom;
    @Column(nullable = false, unique = true) protected String email;
    protected String telephone;
    @Column(nullable = false) protected String motDePasseHash; // BCrypt, jamais en clair
    @Enumerated(EnumType.STRING) @Column(nullable = false) protected Role role;
    protected boolean actif = true;
}
