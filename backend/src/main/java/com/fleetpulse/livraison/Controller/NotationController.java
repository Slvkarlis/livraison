package com.fleetpulse.livraison.Controller;

import com.fleetpulse.livraison.Dto.NotationDto.*;
import com.fleetpulse.livraison.Service.NotationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController @RequiredArgsConstructor @RequestMapping("/api/commandes/{id}/notations")
@io.swagger.v3.oas.annotations.tags.Tag(name = "Notation", description = "Avis définitifs entre participants réels après livraison.")
@PreAuthorize("hasAnyRole('CLIENT', 'LIVREUR', 'PARTENAIRE')")
public class NotationController {
    private final NotationService service;
    @GetMapping
    @io.swagger.v3.oas.annotations.Operation(summary = "Consulter ses avis et cibles", description = "Participant réel uniquement ; retourne ses propres avis et les rôles qu'il peut noter. ouverte est vrai après LIVREE.")
    public NotesVue consulter(Authentication a, @PathVariable Long id) { return service.consulter(a.getName(), id); }
    @PostMapping
    @io.swagger.v3.oas.annotations.Operation(summary = "Noter un participant après livraison", description = "Note entière 1 à 5, commentaire facultatif de 500 caractères maximum. Le serveur détermine l'identité cible. Une seule note définitive par commande/auteur/cible ; doublon ou état non livré : 409 ; tiers : 403.")
    public ResponseEntity<NotesVue> noter(Authentication a, @PathVariable Long id, @RequestBody Demande demande) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.noter(a.getName(), id, demande));
    }
}
