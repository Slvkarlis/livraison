package com.fleetpulse.livraison.Controller;

import com.fleetpulse.livraison.Dto.EspaceLivreurDto.*;
import com.fleetpulse.livraison.Service.EspaceLivreurService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

// US-2B8 : espace du coursier connecte (disponibilite et missions de collecte)
@RestController @RequestMapping("/api/livreur") @RequiredArgsConstructor @PreAuthorize("hasRole('LIVREUR')")
public class EspaceLivreurController {
    private final EspaceLivreurService service;

    @GetMapping("/disponibilite")
    public DisponibiliteVue disponibilite(Authentication a) { return service.disponibilite(a.getName()); }

    @PutMapping("/disponibilite")
    public DisponibiliteVue changerDisponibilite(Authentication a, @RequestBody DisponibiliteRequest r) {
        return service.changerDisponibilite(a.getName(), r);
    }

    @GetMapping("/missions")
    public List<MissionVue> missions(Authentication a) { return service.missions(a.getName()); }

    @GetMapping("/missions/{id}")
    public MissionVue mission(Authentication a, @PathVariable Long id) { return service.mission(a.getName(), id); }
}
