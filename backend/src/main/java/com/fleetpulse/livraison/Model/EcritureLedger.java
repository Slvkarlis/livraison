package com.fleetpulse.livraison.Model;

import com.fleetpulse.livraison.Model.enums.TypeEcriture;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import lombok.*;
import org.hibernate.annotations.Immutable;

/**
 * US-503 : ecriture du ledger financier, jamais modifiee ni supprimee (cahier des charges §4.3).
 * Une correction se fait par une nouvelle ecriture. Les identifiants sont gardes en clair (et non en associations)
 * pour que l'historique reste lisible meme si un compte est suspendu ou supprime.
 */
@Entity @Immutable @Getter @NoArgsConstructor
@Table(indexes = { @Index(name = "idx_ledger_commande", columnList = "commandeId"), @Index(name = "idx_ledger_livreur", columnList = "livreurId,type"),
        @Index(name = "idx_ledger_partenaire", columnList = "partenaireId,type"), @Index(name = "idx_ledger_date", columnList = "date") })
public class EcritureLedger {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Enumerated(EnumType.STRING) @Column(nullable = false, columnDefinition = "varchar(30)") private TypeEcriture type;
    @Column(nullable = false, precision = 14, scale = 3) private BigDecimal montant;
    private Long commandeId;
    private Long partenaireId;
    private Long livreurId;
    private Long depotId;
    private Long closingId;
    @Column(length = 300) private String libelle;
    @Column(nullable = false) private Instant date;

    public EcritureLedger(TypeEcriture type, BigDecimal montant, Long commandeId, Long partenaireId, Long livreurId,
                          Long depotId, Long closingId, String libelle, Instant date) {
        this.type = type;
        this.montant = montant;
        this.commandeId = commandeId;
        this.partenaireId = partenaireId;
        this.livreurId = livreurId;
        this.depotId = depotId;
        this.closingId = closingId;
        this.libelle = libelle;
        this.date = date;
    }
}
