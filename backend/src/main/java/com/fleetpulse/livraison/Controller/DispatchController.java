package com.fleetpulse.livraison.Controller;

import com.fleetpulse.livraison.Dto.DispatchDto.*;
import com.fleetpulse.livraison.Service.DispatchService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

// Sprint 4 (US-407) : supervision du dispatch par le responsable OPERATIONS
@RestController @RequestMapping("/api/admin/dispatch") @RequiredArgsConstructor @PreAuthorize("hasRole('OPERATIONS')")
@Tag(name = "Supervision du dispatch", description = "Commandes prêtes en attente, lots, offres et livreurs disponibles ; affectation forcée motivée et auditée.")
@ApiResponses({
    @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré ; la réponse de sécurité peut être sans corps."),
    @ApiResponse(responseCode = "403", description = "Rôle insuffisant ou accès à une ressource non autorisée.")
})
public class DispatchController {
    private final DispatchService dispatch;

    @GetMapping
    @Operation(summary = "Superviser le dispatch", description = "Commandes prêtes sans livreur (alerte au-delà du délai maximal de recherche), lots proposés ou en cours avec l'historique des offres, livreurs disponibles avec leur charge.")
    public SupervisionVue supervision() { return dispatch.supervision(); }

    @PutMapping("/commandes/{id}/forcer")
    @Operation(summary = "Forcer une assignation", description = "Commande PRETE sans livreur uniquement. livreurId et motif (5 à 300 caractères) obligatoires ; l'offre en cours est retirée, l'action est historisée et auditée (AFFECTATION_FORCEE).")
    @ApiResponse(responseCode = "409", description = "Commande déjà affectée ou livreur à sa charge maximale.")
    public SupervisionVue forcer(Authentication a, @PathVariable Long id, @RequestBody ForcerRequest r) {
        return dispatch.forcer(a.getName(), id, r);
    }

    @PostMapping("/cycle")
    @Operation(summary = "Lancer un cycle de dispatch", description = "Expire les offres échues puis propose les lots en attente, sans attendre le cycle périodique.")
    public CycleVue cycle() { return dispatch.cycle(); }
}
