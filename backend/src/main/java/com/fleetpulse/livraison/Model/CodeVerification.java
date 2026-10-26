package com.fleetpulse.livraison.Model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import com.fleetpulse.livraison.Model.enums.TypeCode;

/** Code a 6 chiffres a usage unique : OTP d'inscription (US-101) ou reinitialisation du mot de passe (US-107). */
@Entity @Getter @Setter @NoArgsConstructor
public class CodeVerification {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false) private String cible;      // telephone (inscription) ou email (reinitialisation)
    @Enumerated(EnumType.STRING) @Column(nullable = false, columnDefinition = "varchar(20)") private TypeCode type;
    @Column(nullable = false) private String codeHash;   // BCrypt, jamais en clair
    @Column(nullable = false) private Instant expireLe;
    private int tentatives;
    private boolean utilise;
    @Column(nullable = false) private Instant creeLe = Instant.now();
}
