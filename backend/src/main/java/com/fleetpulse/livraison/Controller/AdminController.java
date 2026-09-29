package com.fleetpulse.livraison.Controller;

import com.fleetpulse.livraison.Dto.AssignVehiculeRequest;
import com.fleetpulse.livraison.Dto.CreateLivreurRequest;
import com.fleetpulse.livraison.Dto.CreateVehiculeRequest;
import com.fleetpulse.livraison.Dto.LivreurResponse;
import com.fleetpulse.livraison.Dto.VehiculeResponse;
import com.fleetpulse.livraison.Service.AdminService;
import com.fleetpulse.livraison.Service.AdminService.DuplicateDataException;
import java.util.List;
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
@PreAuthorize("hasRole('RESPONSABLE')")
public class AdminController {
    private final AdminService adminService;

    public AdminController(AdminService adminService) {
        this.adminService = adminService;
    }

    @GetMapping("/livreurs")
    public List<LivreurResponse> listLivreurs() { return adminService.listLivreurs(); }

    @PostMapping("/livreurs")
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
    public ResponseEntity<LivreurResponse> updateLivreur(@PathVariable Long id,
                                                          @RequestBody CreateLivreurRequest request) {
        return adminService.updateLivreur(id, request).map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/livreurs/{id}")
    public ResponseEntity<Void> deactivateLivreur(@PathVariable Long id) {
        return adminService.deactivateLivreur(id)
                ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }

    @PutMapping("/livreurs/{id}/activer")
    public ResponseEntity<Void> activateLivreur(@PathVariable Long id) {
        return adminService.activateLivreur(id)
                ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }

    @GetMapping("/vehicules")
    public List<VehiculeResponse> listVehicules() { return adminService.listVehicules(); }

    @PostMapping("/vehicules")
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
    public ResponseEntity<VehiculeResponse> updateVehicule(@PathVariable Long id,
                                                            @RequestBody CreateVehiculeRequest request) {
        return adminService.updateVehicule(id, request).map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/vehicules/{id}")
    public ResponseEntity<Void> deactivateVehicule(@PathVariable Long id) {
        return adminService.deactivateVehicule(id)
                ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }

    @PutMapping("/vehicules/{id}/activer")
    public ResponseEntity<Void> activateVehicule(@PathVariable Long id) {
        return adminService.activateVehicule(id)
                ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }

    @PutMapping("/livreurs/{livreurId}/vehicule")
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
    public ResponseEntity<Void> unassignVehicule(@PathVariable Long livreurId) {
        return adminService.unassignVehicule(livreurId)
                ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }
}
