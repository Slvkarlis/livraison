package com.fleetpulse.livraison.Controller;

import com.fleetpulse.livraison.Dto.EntrepotDto.EchantillonEta;
import com.fleetpulse.livraison.Dto.ProspectDto.LigneProspection;
import com.fleetpulse.livraison.Service.EntrepotService;
import com.fleetpulse.livraison.Service.PrevisionService;
import com.fleetpulse.livraison.Service.PrevisionService.LigneDemande;
import com.fleetpulse.livraison.Service.ProspectionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/** Export unique pour l'entrainement hors serveur (handoff/README.md) : trois jeux dans un seul fichier JSON. */
@RestController @RequestMapping("/api/admin/entrepot") @RequiredArgsConstructor @PreAuthorize("hasRole('OPERATIONS')")
@Tag(name = "Entrepôt IA", description = "Exports d'entraînement du service d'IA.")
public class ExportIaController {
    private final EntrepotService entrepot;
    private final PrevisionService previsions;
    private final ProspectionService prospection;

    /** Reponse : {eta, demande, prospection}, formats de ia/handoff/CONTRATS.md. Aucune donnee personnelle. */
    public record ExportIa(List<EchantillonEta> eta, List<LigneDemande> demande, List<LigneProspection> prospection) { }

    @GetMapping("/export-ia")
    @Operation(summary = "Exporter les trois jeux d'entraînement", description = "ETA, demande par zone et créneau, prospection. depuis : facultatif (ETA sur toute la période par défaut).")
    public ExportIa exporter(@RequestParam(required = false) Instant depuis) {
        return new ExportIa(entrepot.jeuEta(depuis), previsions.jeuDemande(depuis), prospection.jeuProspection());
    }
}
