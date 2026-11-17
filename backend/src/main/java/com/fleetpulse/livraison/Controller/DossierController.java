package com.fleetpulse.livraison.Controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;

import com.fleetpulse.livraison.Dto.CompteResponse;
import com.fleetpulse.livraison.Dto.DossierRequest;
import com.fleetpulse.livraison.Service.CompteService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Le partenaire ou le candidat livreur suit son dossier et le corrige si un complement est demande. */
@RestController
@RequestMapping("/api/dossier")
@Tag(name = "Dossier personnel", description = "Consultation et correction de son propre dossier de candidature.")
@ApiResponses({
    @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré ; la réponse de sécurité peut être sans corps."),
    @ApiResponse(responseCode = "403", description = "Rôle insuffisant ou accès à une ressource non autorisée.")
})
public class DossierController {
    @Autowired
    private CompteService compteService;

    @GetMapping
    @Operation(summary = "Consulter son dossier", description = "L’identité est déduite du JWT ; aucun identifiant d’un autre compte ne peut être fourni.")
    public CompteResponse monDossier(Authentication authentication) {
        return compteService.monDossier(authentication.getName());
    }

    @PutMapping
    @PreAuthorize("hasRole('CANDIDAT')")
    @Operation(summary = "Corriger son dossier", description = "Réservé au candidat lorsqu’un complément a été demandé. Une correction valide remet le dossier en attente.")
    public CompteResponse corriger(@RequestBody DossierRequest request, Authentication authentication) {
        return compteService.corrigerDossier(authentication.getName(), request);
    }
}
