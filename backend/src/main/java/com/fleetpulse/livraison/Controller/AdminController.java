package com.fleetpulse.livraison.Controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;

import com.fleetpulse.livraison.Dto.AssignVehiculeRequest;
import com.fleetpulse.livraison.Dto.CreateLivreurRequest;
import com.fleetpulse.livraison.Dto.CreateVehiculeRequest;
import com.fleetpulse.livraison.Dto.LivreurResponse;
import com.fleetpulse.livraison.Dto.VehiculeResponse;
import com.fleetpulse.livraison.Service.AdminService;
import com.fleetpulse.livraison.Service.AdminService.DuplicateDataException;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('OPERATIONS')")   // flotte : sous-role operations (ou administrateur principal)
@Tag(name = "Flotte", description = "Gestion des livreurs et des véhicules par le responsable OPERATIONS.")
@ApiResponses({
    @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré ; la réponse de sécurité peut être sans corps."),
    @ApiResponse(responseCode = "403", description = "Rôle insuffisant ou accès à une ressource non autorisée.")
})
public class AdminController {
    @Autowired
    private AdminService adminService;

    @GetMapping("/livreurs")
    @Operation(summary = "Lister les livreurs", description = "Retourne la flotte active ou suspendue, avec la zone principale de chaque livreur.")
    public List<LivreurResponse> listLivreurs() { return adminService.listLivreurs(); }

    @PostMapping("/livreurs")
    @Operation(summary = "Créer un livreur", description = "Crée un compte livreur actif. Le mot de passe est haché ; un email déjà utilisé entraîne un conflit 409.")
    public ResponseEntity<LivreurResponse> createLivreur(@RequestBody CreateLivreurRequest request) {
        try {
            return ResponseEntity.status(HttpStatus.CREATED).body(adminService.createLivreur(request));
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.badRequest().build();
        } catch (DuplicateDataException exception) {
            return ResponseEntity.status(HttpStatus.CONFLICT).build();
        }
    }

    @PutMapping("/livreurs/{id}")
    @Operation(summary = "Modifier un livreur", description = "Modifie les champs fournis. Les champs absents sont conservés ; retourne 404 si le livreur est absent.")
    public ResponseEntity<LivreurResponse> updateLivreur(@PathVariable Long id,
                                                          @RequestBody CreateLivreurRequest request) {
        return adminService.updateLivreur(id, request).map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/livreurs/{id}")
    @Operation(summary = "Désactiver un livreur", description = "Suspension logique : conserve les commandes et révoque les jetons de rafraîchissement.")
    public ResponseEntity<Void> deactivateLivreur(@PathVariable Long id) {
        return adminService.deactivateLivreur(id)
                ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }

    @PutMapping("/livreurs/{id}/activer")
    @Operation(summary = "Réactiver un livreur", description = "Réactive un livreur de la flotte ; ne valide pas les dossiers de candidature.")
    public ResponseEntity<Void> activateLivreur(@PathVariable Long id) {
        return adminService.activateLivreur(id)
                ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }

    @GetMapping("/vehicules")
    @Operation(summary = "Lister les véhicules", description = "Retourne les véhicules triés par immatriculation, y compris les véhicules désactivés.")
    public List<VehiculeResponse> listVehicules() { return adminService.listVehicules(); }

    @GetMapping("/vehicules/{id}")
    @Operation(summary = "Consulter un véhicule par ID", description = "Retourne le véhicule demandé ou 404. Cette lecture complète le CRUD du TP 5.")
    public ResponseEntity<VehiculeResponse> getVehicule(@PathVariable Long id) {
        return adminService.findVehicule(id).map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping("/vehicules")
    @Operation(summary = "Créer un véhicule", description = "Immatriculation obligatoire et unique, normalisée en majuscules. Consommation facultative, entre 2 et 30 L/100 km.")
    public ResponseEntity<VehiculeResponse> createVehicule(@RequestBody CreateVehiculeRequest request) {
        try {
            return ResponseEntity.status(HttpStatus.CREATED).body(adminService.createVehicule(request));
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.badRequest().build();
        } catch (DuplicateDataException exception) {
            return ResponseEntity.status(HttpStatus.CONFLICT).build();
        }
    }

    @PutMapping("/vehicules/{id}")
    @Operation(summary = "Modifier un véhicule", description = "Modifie les champs fournis et conserve les autres. Retourne 404 si le véhicule est absent.")
    public ResponseEntity<VehiculeResponse> updateVehicule(@PathVariable Long id,
                                                            @RequestBody CreateVehiculeRequest request) {
        return adminService.updateVehicule(id, request).map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/vehicules/{id}")
    @Operation(summary = "Désactiver un véhicule", description = "Suppression logique : le véhicule est conservé pour préserver l’historique. Réponse 204 sans corps, ou 404.")
    public ResponseEntity<Void> deactivateVehicule(@PathVariable Long id) {
        return adminService.deactivateVehicule(id)
                ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }

    @PutMapping("/vehicules/{id}/activer")
    @Operation(summary = "Réactiver un véhicule", description = "Rend le véhicule à nouveau actif. Réponse 204 sans corps, ou 404.")
    public ResponseEntity<Void> activateVehicule(@PathVariable Long id) {
        return adminService.activateVehicule(id)
                ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }

    @PutMapping("/livreurs/{livreurId}/vehicule")
    @Operation(summary = "Affecter un véhicule à un livreur", description = "Le véhicule doit être actif. S’il est affecté à un autre livreur, cette affectation est libérée avant le transfert.")
    public ResponseEntity<LivreurResponse> assignVehicule(@PathVariable Long livreurId,
        @RequestBody AssignVehiculeRequest request) {
        try {
            return adminService.assignVehicule(livreurId, request).map(ResponseEntity::ok)
                    .orElseGet(() -> ResponseEntity.notFound().build());
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.badRequest().build();
        }
    }

    @DeleteMapping("/livreurs/{livreurId}/vehicule")
    @Operation(summary = "Retirer le véhicule d’un livreur", description = "Retire uniquement l’affectation ; ne supprime ni le livreur ni le véhicule.")
    public ResponseEntity<Void> unassignVehicule(@PathVariable Long livreurId) {
        return adminService.unassignVehicule(livreurId)
                ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }
}
