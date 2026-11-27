package com.fleetpulse.livraison.Model;

import jakarta.persistence.*;
import lombok.*;

@Entity @Getter @Setter @NoArgsConstructor
public class ConfigurationQuartier {
    @Id private Long id = 1L;
    @Column(nullable = false, length = 2000) private String valeur;
}
