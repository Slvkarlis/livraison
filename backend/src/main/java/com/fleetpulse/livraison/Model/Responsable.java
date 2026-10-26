package com.fleetpulse.livraison.Model;

import jakarta.persistence.*;
import lombok.*;
import com.fleetpulse.livraison.Model.enums.SousRole;

@Entity @Getter @Setter @NoArgsConstructor
public class Responsable extends Utilisateur {
    // null : administrateur principal (tous les droits)
    @Enumerated(EnumType.STRING) @Column(columnDefinition = "varchar(20)") private SousRole sousRole;
}
