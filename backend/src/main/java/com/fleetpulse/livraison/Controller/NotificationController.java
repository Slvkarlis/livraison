package com.fleetpulse.livraison.Controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;

import com.fleetpulse.livraison.Dto.NotificationDto.*;
import com.fleetpulse.livraison.Service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

// US-304 : boite de reception et telephones de l'utilisateur connecte (tous roles)
@RestController @RequestMapping("/api/notifications") @RequiredArgsConstructor
@Tag(name = "Notifications", description = "Boîte de réception et appareils du compte connecté, tous rôles.")
@ApiResponses({
    @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré ; la réponse de sécurité peut être sans corps."),
    @ApiResponse(responseCode = "403", description = "Rôle insuffisant ou accès à une ressource non autorisée.")
})
public class NotificationController {
    private final NotificationService service;

    @GetMapping
    @Operation(summary = "Consulter ses notifications", description = "Les cinquante dernières notifications avec le nombre total de notifications non lues.")
    public BoiteNotifications boite(Authentication a) { return service.boite(a.getName()); }

    @PutMapping("/lues")
    @Operation(summary = "Marquer ses notifications comme lues", description = "Action limitée au destinataire connecté. Réponse 204 sans corps.")
    public ResponseEntity<Void> marquerLues(Authentication a) {
        service.marquerLues(a.getName());
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/appareil")
    @Operation(summary = "Enregistrer son appareil push", description = "Jeton ExpoPushToken ou ExponentPushToken valide. Un téléphone partagé est rattaché au dernier compte connecté.")
    public ResponseEntity<Void> enregistrerAppareil(Authentication a, @RequestBody AppareilRequest r) {
        service.enregistrerAppareil(a.getName(), r);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/appareil")
    @Operation(summary = "Retirer son appareil push", description = "Ne retire le jeton que s’il appartient au compte connecté. Réponse 204 sans corps.")
    public ResponseEntity<Void> retirerAppareil(Authentication a, @RequestBody AppareilRequest r) {
        service.retirerAppareil(a.getName(), r);
        return ResponseEntity.noContent().build();
    }
}
