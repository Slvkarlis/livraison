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
}
