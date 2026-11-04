package com.fleetpulse.livraison.Controller;

import com.fleetpulse.livraison.Dto.CommandePartenaireDto.*;
import com.fleetpulse.livraison.Model.enums.StatutLivraison;
import com.fleetpulse.livraison.Service.CommandePartenaireService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/partenaire/commandes") @RequiredArgsConstructor @PreAuthorize("hasRole('PARTENAIRE')")
public class CommandePartenaireController {
    private final CommandePartenaireService service;

    // US-2B1 : commandes recues, filtre facultatif ?statut=PENDING_PARTNER&statut=ACCEPTEE
    @GetMapping
    public List<CommandeResume> lister(Authentication a, @RequestParam(required = false) List<StatutLivraison> statut) {
        return service.lister(a.getName(), statut);
    }

    @GetMapping("/{id}")
    public CommandeDetail detail(Authentication a, @PathVariable Long id) { return service.detail(a.getName(), id); }

    // US-2B2 : decision du partenaire sur une commande PENDING_PARTNER
    @PutMapping("/{id}/accepter")
    public CommandeDetail accepter(Authentication a, @PathVariable Long id, @RequestBody TempsPreparationRequest r) {
        return service.accepter(a.getName(), id, r);
    }

    @PutMapping("/{id}/refuser")
    public CommandeDetail refuser(Authentication a, @PathVariable Long id, @RequestBody RefusRequest r) {
        return service.refuser(a.getName(), id, r);
    }

    // US-2B4 : preparation (debut, nouveau delai restant au plus 2 fois)
    @PutMapping("/{id}/preparation/debut")
    public CommandeDetail commencerPreparation(Authentication a, @PathVariable Long id) {
        return service.commencerPreparation(a.getName(), id);
    }

    @PutMapping("/{id}/preparation/temps")
    public CommandeDetail ajusterPreparation(Authentication a, @PathVariable Long id, @RequestBody TempsPreparationRequest r) {
        return service.ajusterPreparation(a.getName(), id, r);
    }

    // US-2B5 : commande prete pour la collecte
    @PutMapping("/{id}/prete")
    public CommandeDetail marquerPrete(Authentication a, @PathVariable Long id) { return service.marquerPrete(a.getName(), id); }
}
