package com.fleetpulse.livraison.Model;

import com.fleetpulse.livraison.Model.enums.StatutLot;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.*;

/**
 * US-403 : regroupement de 1 a 3 collectes proches confie a un seul coursier, avec l'itineraire ordonne (US-404).
 * Les commandes portent le lot (Livraison.lot) ; l'itineraire est garde sous forme compacte « C:12;C:13;L:12;L:13 »
 * (C = collecte au commerce, L = livraison au client, suivi de l'identifiant de la commande).
 */
@Entity @Getter @Setter @NoArgsConstructor
@Table(indexes = @Index(name = "idx_lot_statut", columnList = "statut"))
public class Lot {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Enumerated(EnumType.STRING) @Column(nullable = false, columnDefinition = "varchar(20)") private StatutLot statut = StatutLot.PROPOSE;
    @ManyToOne private Livreur livreur;               // coursier qui a accepte le lot (ou impose par le responsable)
    @Column(length = 400) private String itineraire;
    private double distanceKm;                         // trajet total estime, collectes et livraisons comprises
    private int dureeMinutes;                          // duree totale estimee
    @Column(length = 20) private String source;        // IA, REGLES ou FORCE (US-407)
    @Column(length = 400) private String livreursExclus;   // coursiers ayant refuse ou laisse expirer une offre de ce lot
    @Column(nullable = false) private Instant creeLe = Instant.now();
    private Instant accepteLe;

    public Set<Long> exclus() {
        if (livreursExclus == null || livreursExclus.isBlank()) return new LinkedHashSet<>();
        return Arrays.stream(livreursExclus.split(",")).map(String::trim).filter(s -> !s.isEmpty()).map(Long::valueOf)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    public void exclure(Long livreurId) {
        Set<Long> ids = exclus();
        ids.add(livreurId);
        livreursExclus = ids.stream().map(String::valueOf).collect(Collectors.joining(","));
    }
}
