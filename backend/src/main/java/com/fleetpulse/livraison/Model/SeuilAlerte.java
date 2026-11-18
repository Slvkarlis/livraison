package com.fleetpulse.livraison.Model;

import com.fleetpulse.livraison.Model.enums.TypeAlerte;
import jakarta.persistence.*;
import java.math.BigDecimal;
import lombok.*;

@Entity @Getter @Setter @NoArgsConstructor
public class SeuilAlerte {
    @Id @Enumerated(EnumType.STRING) @Column(length = 40) private TypeAlerte type;
    @Column(nullable = false, precision = 14, scale = 3) private BigDecimal valeur;
    @Column(nullable = false) private boolean actif = true;
    @Version private long version;
    public SeuilAlerte(TypeAlerte type) { this.type = type; this.valeur = type.defaut.setScale(3); }
}
