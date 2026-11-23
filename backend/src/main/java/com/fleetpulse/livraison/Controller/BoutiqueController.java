package com.fleetpulse.livraison.Controller;

import com.fleetpulse.livraison.Service.BoutiqueService;
import com.fleetpulse.livraison.Service.BoutiqueService.Etat;
import com.fleetpulse.livraison.Service.BoutiqueService.Horaires;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** US-2B6 : horaires et pause de la boutique du partenaire connecte. */
@RestController @RequestMapping("/api/partenaire/boutique") @RequiredArgsConstructor @PreAuthorize("hasRole('PARTENAIRE')")
@Tag(name = "Boutique", description = "Horaires d'ouverture et pause du commerce.")
public class BoutiqueController {
    private final BoutiqueService service;

    @GetMapping
    @Operation(summary = "Consulter ma boutique", description = "Ouverture, horaires, pause en cours et si le commerce accepte des commandes maintenant.")
    public Etat etat(Authentication a) { return service.etat(a.getName()); }

    @PutMapping("/horaires")
    @Operation(summary = "Modifier les horaires", description = "ouverture et fermeture au format HH:mm (heure de Tunis), jours de 1 (lundi) à 7. Une fermeture avant l'ouverture passe minuit.")
    public Etat horaires(Authentication a, @RequestBody Horaires h) { return service.modifierHoraires(a.getName(), h); }

    @PostMapping("/pause")
    @Operation(summary = "Mettre la boutique en pause", description = "Durée en minutes : de 15 à 1440.")
    public Etat pause(Authentication a, @RequestBody Map<String, Integer> corps) {
        return service.pause(a.getName(), corps == null ? null : corps.get("minutes"));
    }

    @DeleteMapping("/pause")
    @Operation(summary = "Reprendre les commandes", description = "Leve une pause manuelle ou automatique ; le compteur d'expirations repart a zero.")
    public Etat reprendre(Authentication a) { return service.reprendre(a.getName()); }
}
