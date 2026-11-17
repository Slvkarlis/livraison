package com.fleetpulse.livraison.Controller;

import com.fleetpulse.livraison.Dto.FinanceDto.CaisseLivreurVue;
import com.fleetpulse.livraison.Service.CaisseService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

// US-504 / US-512 : caisse et remuneration du livreur connecte
@RestController @RequestMapping("/api/livreur") @RequiredArgsConstructor @PreAuthorize("hasRole('LIVREUR')")
@Tag(name = "Caisse livreur", description = "Solde de cash, commandes encaissées, reçus de dépôt et relevés de rémunération du livreur connecté.")
@ApiResponses({
    @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré ; la réponse de sécurité peut être sans corps."),
    @ApiResponse(responseCode = "403", description = "Rôle insuffisant ou accès à une ressource non autorisée.")
})
public class CaisseLivreurController {
    private final CaisseService caisses;

    @GetMapping("/caisse")
    @Operation(summary = "Consulter sa caisse", description = "Solde à déposer, commandes encaissées non déposées, reçus de dépôt, missions pas encore payées et relevés hebdomadaires.")
    public CaisseLivreurVue caisse(Authentication a) { return caisses.caisseDuLivreur(a.getName()); }
}
