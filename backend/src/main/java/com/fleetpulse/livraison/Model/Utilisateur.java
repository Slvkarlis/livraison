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
    protected boolean telephoneVerifie;                        // true apres validation par OTP (US-101)
    @Column(nullable = false) protected String motDePasseHash; // BCrypt, jamais en clair
    // varchar et non ENUM MySQL : ddl-auto=update n'ajoute jamais de nouvelle valeur a un ENUM
    @Enumerated(EnumType.STRING) @Column(nullable = false, columnDefinition = "varchar(20)") protected Role role;
    // Remplace l'ancien booleen "actif" (voir MigrationComptes)
    @Enumerated(EnumType.STRING) @Column(nullable = false, columnDefinition = "varchar(20) default 'ACTIF'")
    protected StatutCompte statut = StatutCompte.ACTIF;
    @Column(length = 500) protected String motifStatut;        // dernier motif de refus, complement ou suspension
    protected Instant dateCreation = Instant.now();

    public boolean isActif() {
        return statut == StatutCompte.ACTIF;
    }
}
