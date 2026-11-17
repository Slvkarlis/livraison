package com.fleetpulse.livraison.Controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;

import com.fleetpulse.livraison.Dto.ProfilResponse;
import com.fleetpulse.livraison.Service.ProfilService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/me")
@Tag(name = "Profil", description = "Profil applicatif du compte connecté.")
@ApiResponses({
    @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré ; la réponse de sécurité peut être sans corps."),
    @ApiResponse(responseCode = "403", description = "Rôle insuffisant ou accès à une ressource non autorisée.")
})
public class ProfilController {
    @Autowired
    private ProfilService profilService;

    // US-01 : les applications recuperent le role et le vehicule du livreur apres connexion
    @GetMapping
    @Operation(summary = "Consulter son profil", description = "Identité publique, rôle, statut et véhicule affecté. Les mots de passe et jetons ne sont jamais exposés.")
    public ResponseEntity<ProfilResponse> me(Authentication authentication) {
        return profilService.findByEmail(authentication.getName()).map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
