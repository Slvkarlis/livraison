package com.fleetpulse.livraison.Controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;

import com.fleetpulse.livraison.Dto.LivraisonResponse;
import com.fleetpulse.livraison.Service.LivraisonService;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// Creation des commandes : POST /api/commandes (MarketplaceController).
@RestController
@RequestMapping("/api/livraisons")
@Tag(name = "Historique des livraisons", description = "Consultation de l’historique ; la création passe par le catalogue et /api/commandes.")
@ApiResponses({
    @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré ; la réponse de sécurité peut être sans corps."),
    @ApiResponse(responseCode = "403", description = "Rôle insuffisant ou accès à une ressource non autorisée.")
})
public class LivraisonController {
    @Autowired
    private LivraisonService livraisonService;

    // US-209 : le client suit les commandes qu'il a creees
    @GetMapping("/mes")
    @PreAuthorize("hasRole('CLIENT')")
    @Operation(summary = "Lister ses commandes client", description = "Retourne uniquement les commandes du client connecté, de la plus récente à la plus ancienne.")
    public List<LivraisonResponse> mesLivraisons(Authentication authentication) {
        return livraisonService.listForClient(authentication.getName());
    }

    // US-07
    @GetMapping
    @PreAuthorize("hasRole('RESPONSABLE')")
    @Operation(summary = "Lister les commandes du responsable", description = "Vue globale réservée aux responsables. Inclut les commandes terminées et les commandes historiques.")
    public List<LivraisonResponse> list() {
        return livraisonService.listAll();
    }
}
