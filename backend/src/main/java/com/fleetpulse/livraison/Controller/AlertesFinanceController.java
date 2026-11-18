package com.fleetpulse.livraison.Controller;

import com.fleetpulse.livraison.Dto.AlerteDto.*;
import com.fleetpulse.livraison.Model.enums.TypeAlerte;
import com.fleetpulse.livraison.Service.AlerteService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController @RequiredArgsConstructor @RequestMapping("/api/admin/finance/bi") @PreAuthorize("hasRole('FINANCE')")
public class AlertesFinanceController {
    private final AlerteService service;
    @GetMapping("/seuils") public List<SeuilVue> seuils() { return service.seuils(true); }
    @PutMapping("/seuils/{type}") public SeuilVue modifier(@PathVariable TypeAlerte type, @RequestBody DemandeSeuil r) { return service.modifier(true, type, r); }
    @GetMapping("/alertes") public List<AlerteVue> alertes() { return service.actualiser(true); }
}
