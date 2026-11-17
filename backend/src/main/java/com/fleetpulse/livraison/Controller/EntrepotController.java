package com.fleetpulse.livraison.Controller;

import com.fleetpulse.livraison.Dto.EntrepotDto.*;
import com.fleetpulse.livraison.Model.enums.TypeEvenement;
import com.fleetpulse.livraison.Service.EntrepotService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

// Sprint 4 (US-401) : entrepot de donnees, lu par le responsable et exporte vers le service d'IA
@RestController @RequestMapping("/api/admin/entrepot") @RequiredArgsConstructor @PreAuthorize("hasRole('OPERATIONS')")
@Tag(name = "Entrepôt de données", description = "Événements historisés (statuts, préparation, offres, affectations) et jeux d'entraînement du modèle d'ETA.")
@ApiResponses({
    @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré ; la réponse de sécurité peut être sans corps."),
    @ApiResponse(responseCode = "403", description = "Rôle insuffisant ou accès à une ressource non autorisée.")
})
public class EntrepotController {
    private final EntrepotService entrepot;

    @GetMapping("/evenements")
    @Operation(summary = "Lire les événements", description = "Depuis une date ISO-8601 (défaut : début), filtrés par type ; 200 par défaut, 5000 au plus, du plus ancien au plus récent.")
    public List<EvenementVue> evenements(@RequestParam(required = false) Instant depuis, @RequestParam(required = false) TypeEvenement type,
                                         @RequestParam(required = false) Integer limite) {
        return entrepot.evenements(depuis, type, limite);
    }

    @GetMapping("/jeu-eta")
    @Operation(summary = "Jeu d'entraînement de l'ETA", description = "Une ligne par commande livrée : caractéristiques connues à l'acceptation et durées réelles (préparation, attente, trajet).")
    public List<EchantillonEta> jeuEta(@RequestParam(required = false) Instant depuis) { return entrepot.jeuEta(depuis); }

    @GetMapping("/export")
    @Operation(summary = "Exporter l'entrepôt", description = "Événements, jeu d'ETA, traces GPS des missions et zones avec leurs voisines, pour ia/entrainer.py.")
    public ExportEntrepot exporter(@RequestParam(required = false) Instant depuis) { return entrepot.exporter(depuis); }
}
