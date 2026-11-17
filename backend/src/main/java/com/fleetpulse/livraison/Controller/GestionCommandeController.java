package com.fleetpulse.livraison.Controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;

import com.fleetpulse.livraison.Dto.GestionCommandeDto.*;
import com.fleetpulse.livraison.Service.GestionCommandeService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

// US-311 : interventions du responsable sur une commande (sous-role operations ou administrateur principal)
@RestController @RequestMapping("/api/admin/commandes/{id}") @RequiredArgsConstructor @PreAuthorize("hasRole('OPERATIONS')")
@Tag(name = "Interventions responsable", description = "Interventions OPERATIONS sur les commandes bloquées, toujours motivées et auditées.")
@ApiResponses({
    @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré ; la réponse de sécurité peut être sans corps."),
    @ApiResponse(responseCode = "403", description = "Rôle insuffisant ou accès à une ressource non autorisée.")
})
public class GestionCommandeController {
    private final GestionCommandeService service;

    @GetMapping("/suivi")
    @Operation(summary = "Consulter le suivi responsable", description = "Retourne les étapes, le montant attendu, le paiement et les actions autorisées au statut courant.")
    public SuiviResponsable suivi(@PathVariable Long id) { return service.suivi(id); }

    @PutMapping("/annuler")
    @Operation(summary = "Annuler une commande non terminée", description = "Motif de 5 à 300 caractères obligatoire. Invalide le QR de remise et conserve la trace de l’intervention.")
    public SuiviResponsable annuler(Authentication a, @PathVariable Long id, @RequestBody MotifRequest r) {
        return service.annuler(a.getName(), id, r);
    }

    @PutMapping("/collecte")
    @Operation(summary = "Confirmer manuellement une collecte", description = "Uniquement pour une commande AFFECTEE. Solution de secours si l’étiquette est illisible ; motif de 5 à 300 caractères.")
    public SuiviResponsable validerCollecte(Authentication a, @PathVariable Long id, @RequestBody MotifRequest r) {
        return service.validerCollecte(a.getName(), id, r);
    }

    @PutMapping("/remise")
    @Operation(summary = "Confirmer manuellement une remise", description = "Solution de secours sans QR/code. Colis déjà collecté, montant encaissé et motif de 5 à 300 caractères obligatoires ; motifEcart si le montant diffère.")
    public SuiviResponsable validerRemise(Authentication a, @PathVariable Long id, @RequestBody RemiseManuelleRequest r) {
        return service.validerRemise(a.getName(), id, r);
    }
}
