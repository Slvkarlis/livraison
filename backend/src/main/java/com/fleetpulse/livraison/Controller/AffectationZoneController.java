package com.fleetpulse.livraison.Controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;

import com.fleetpulse.livraison.Dto.AffectationZoneDto.*;
import com.fleetpulse.livraison.Service.AffectationZoneService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

// US-2B11 : zones de travail d'un coursier (sous-role OPERATIONS ou administrateur principal)
@RestController @RequestMapping("/api/admin/livreurs/{livreurId}/zones") @RequiredArgsConstructor
@PreAuthorize("hasRole('OPERATIONS')")
@Tag(name = "Zones des livreurs", description = "Autorisations de travail des livreurs, gérées par OPERATIONS.")
@ApiResponses({
    @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré ; la réponse de sécurité peut être sans corps."),
    @ApiResponse(responseCode = "403", description = "Rôle insuffisant ou accès à une ressource non autorisée.")
})
public class AffectationZoneController {
    private final AffectationZoneService service;

    @GetMapping
    @Operation(summary = "Lister les zones d’un livreur", description = "Inclut les affectations principales, secondaires et temporaires, avec leur validité à l’instant présent.")
    public List<AffectationVue> lister(@PathVariable Long livreurId) { return service.lister(livreurId); }

    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Affecter une zone à un livreur", description = "Une seule zone principale et une seule affectation par couple livreur/zone. Pour TEMPORAIRE, fournir debut et fin au format ISO 8601.")
    public AffectationVue affecter(@PathVariable Long livreurId, @RequestBody AffectationRequest r) { return service.affecter(livreurId, r); }

    @DeleteMapping("/{affectationId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Retirer une affectation de zone", description = "Vérifie que l’affectation appartient au livreur indiqué. Réponse 204 sans corps.")
    public void retirer(@PathVariable Long livreurId, @PathVariable Long affectationId) { service.retirer(livreurId, affectationId); }
}
