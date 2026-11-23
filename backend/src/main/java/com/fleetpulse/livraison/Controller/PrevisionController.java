package com.fleetpulse.livraison.Controller;

import com.fleetpulse.livraison.Dto.ProspectDto.*;
import com.fleetpulse.livraison.Model.enums.StatutProspect;
import com.fleetpulse.livraison.Service.PrevisionService;
import com.fleetpulse.livraison.Service.PrevisionService.*;
import com.fleetpulse.livraison.Service.ProspectionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/** Sprint 8 : prevision de demande (US-804, US-805) et prospection (US-801 a US-803), reserves a OPERATIONS. */
@RestController @RequiredArgsConstructor @PreAuthorize("hasRole('OPERATIONS')")
@Tag(name = "Prévisions et prospection", description = "Demande prévue par zone et créneau, alertes de sous-couverture, prospects classés par score.")
public class PrevisionController {
    private static final ZoneId FUSEAU = ZoneId.of("Africa/Tunis");
    private final PrevisionService previsions;
    private final ProspectionService prospection;

    @GetMapping("/api/admin/previsions")
    @Operation(summary = "Prévoir la demande d'un jour", description = "Commandes attendues par zone et par heure (10 h à 22 h). Source : service d'IA, ou moyenne historique si indisponible.")
    public List<Prevision> prevoir(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate jour) {
        return previsions.prevoir(jour == null ? LocalDate.now(FUSEAU) : jour);
    }

    @GetMapping("/api/admin/previsions/alertes")
    @Operation(summary = "Alertes de sous-couverture", description = "Créneaux où la demande prévue dépasse la capacité des coursiers disponibles, avec le renfort recommandé.")
    public List<AlerteCouverture> alertes(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate jour) {
        return previsions.alertes(jour == null ? LocalDate.now(FUSEAU) : jour);
    }

    @PostMapping("/api/admin/prospects/import")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Importer des commerces prospects", description = "Source autorisée obligatoire. Les lignes invalides sont renvoyées sans bloquer les autres.")
    public ImportVue importer(@RequestBody ImportRequest r) { return prospection.importer(r); }

    @PostMapping("/api/admin/prospects/scoring")
    @Operation(summary = "Recalculer le score de potentiel", description = "Score 0 à 100 pour chaque prospect non clos. Modèle d'IA, ou règle lisible en repli.")
    public int scorer() { return prospection.scorer(); }

    @GetMapping("/api/admin/prospects")
    @Operation(summary = "Lister les prospects", description = "Triés par score décroissant. Filtre facultatif par statut.")
    public List<ProspectVue> lister(@RequestParam(required = false) StatutProspect statut) { return prospection.liste(statut); }

    @PutMapping("/api/admin/prospects/{id}/statut")
    @Operation(summary = "Changer le statut d'un prospect", description = "A_CONTACTER → CONTACTE → INTERESSE → INSCRIT ; REFUSE possible avant l'inscription (motif obligatoire).")
    public ProspectVue statut(@PathVariable Long id, @RequestBody ChangementStatut r) { return prospection.changerStatut(id, r); }

    @GetMapping("/api/admin/prospects/jeu")
    @Operation(summary = "Jeu d'entraînement du score", description = "Prospects dont l'issue est connue (inscrit ou refusé), format CONTRATS.md.")
    public List<LigneProspection> jeu() { return prospection.jeuProspection(); }

    @GetMapping("/api/admin/previsions/jeu-demande")
    @Operation(summary = "Jeu d'entraînement de la demande", description = "Une ligne par zone, date et heure ouverte, depuis la date donnée (90 jours par défaut).")
    public List<LigneDemande> jeuDemande(@RequestParam(required = false) Instant depuis) { return previsions.jeuDemande(depuis); }
}
