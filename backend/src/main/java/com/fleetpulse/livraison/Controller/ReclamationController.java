package com.fleetpulse.livraison.Controller;

import com.fleetpulse.livraison.Dto.ReclamationDto.*;
import com.fleetpulse.livraison.Service.ReclamationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** US-516 : reclamations du client. US-517 : traitement par la finance. */
@RestController @RequiredArgsConstructor
@Tag(name = "Réclamations", description = "Réclamation du client après livraison et traitement par la finance.")
public class ReclamationController {
    private final ReclamationService service;

    @PostMapping("/api/reclamations")
    @PreAuthorize("hasRole('CLIENT')")
    @Operation(summary = "Ouvrir une réclamation", description = "Sur une commande livrée du client, dans les 48 h, une seule par commande. Montant demandé ≤ total.")
    @ResponseStatus(HttpStatus.CREATED)
    public ReclamationVue ouvrir(Authentication a, @RequestBody OuvertureRequest r) { return service.ouvrir(a.getName(), r); }

    @GetMapping("/api/reclamations")
    @PreAuthorize("hasRole('CLIENT')")
    @Operation(summary = "Lister mes réclamations", description = "Réclamations ouvertes par le client connecté, la plus récente d'abord.")
    public List<ReclamationVue> mes(Authentication a) { return service.mesReclamations(a.getName()); }

    @GetMapping("/api/admin/finance/reclamations")
    @PreAuthorize("hasRole('FINANCE')")
    @Operation(summary = "Réclamations à traiter", description = "Réclamations OUVERTES, les plus anciennes d'abord.")
    public List<ReclamationVue> aTraiter() { return service.aTraiter(); }

    @PostMapping("/api/admin/finance/reclamations/{id}/decision")
    @PreAuthorize("hasRole('FINANCE')")
    @Operation(summary = "Décider d'une réclamation", description = "montantRembourse 0 rejette. Sinon imputation PARTENAIRE, COURSIER ou RESPONSABLE ; écritures REMBOURSEMENT et COMPENSATION au ledger.")
    public ReclamationVue decider(Authentication a, @PathVariable Long id, @RequestBody DecisionRequest r) {
        return service.decider(a.getName(), id, r);
    }
}
