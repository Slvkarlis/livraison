package com.fleetpulse.livraison.Controller;

import com.fleetpulse.livraison.Dto.NotationDto.*;
import com.fleetpulse.livraison.Service.NotationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController @RequiredArgsConstructor @RequestMapping("/api/commandes/{id}/notations")
@PreAuthorize("hasAnyRole('CLIENT', 'LIVREUR', 'PARTENAIRE')")
public class NotationController {
    private final NotationService service;
    @GetMapping public NotesVue consulter(Authentication a, @PathVariable Long id) { return service.consulter(a.getName(), id); }
    @PostMapping public ResponseEntity<NotesVue> noter(Authentication a, @PathVariable Long id, @RequestBody Demande demande) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.noter(a.getName(), id, demande));
    }
}
