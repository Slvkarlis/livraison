package com.fleetpulse.livraison.Controller;

import com.fleetpulse.livraison.Dto.BiDto.VentesVue;
import com.fleetpulse.livraison.Service.*;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController @RequiredArgsConstructor @RequestMapping("/api/partenaire/ventes") @PreAuthorize("hasRole('PARTENAIRE')")
@io.swagger.v3.oas.annotations.tags.Tag(name = "Ventes partenaire", description = "Statistiques privées du partenaire actif connecté.")
public class VentesPartenaireController {
    private final VentesPartenaireService service;
    @GetMapping
    @io.swagger.v3.oas.annotations.Operation(summary = "Consulter ses ventes d'articles livrés", description = "CA hors frais avant commission, commandes LIVREE et top 20 produits par quantité puis CA. Le partenaire est déduit du compte actif connecté, jamais d'un identifiant de requête. Date de livraison, dates incluses Africa/Tunis.")
    public VentesVue ventes(Authentication a, @RequestParam(required = false) LocalDate debut,
            @RequestParam(required = false) LocalDate fin) {
        return service.dashboard(a.getName(), PeriodeBi.de(debut, fin));
    }
}
