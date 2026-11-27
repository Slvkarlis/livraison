package com.fleetpulse.livraison.Model;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.*;

@Entity @Getter @Setter @NoArgsConstructor
@Table(uniqueConstraints = @UniqueConstraint(columnNames = {"client_id", "groupe_id"}),
       indexes = @Index(columnList = "client_id,envoyeeLe"))
public class InvitationQuartier {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(optional = false) private Client client;
    @ManyToOne(optional = false) private GroupeQuartier groupe;
    private Instant envoyeeLe;
}
