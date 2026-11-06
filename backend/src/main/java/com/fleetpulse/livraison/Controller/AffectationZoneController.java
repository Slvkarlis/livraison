package com.fleetpulse.livraison.Controller;

import com.fleetpulse.livraison.Dto.AffectationZoneDto.*;
import com.fleetpulse.livraison.Service.AffectationZoneService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

// US-2B11 : zones de travail d'un coursier (sous-role OPERATIONS ou administrateur principal)
@RestController @RequestMapping("/api/admin/livreurs/{livreurId}/zones") @RequiredArgsConstructor
@PreAuthorize("hasRole('OPERATIONS')")
public class AffectationZoneController {
    private final AffectationZoneService service;

    @GetMapping
    public List<AffectationVue> lister(@PathVariable Long livreurId) { return service.lister(livreurId); }

    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public AffectationVue affecter(@PathVariable Long livreurId, @RequestBody AffectationRequest r) { return service.affecter(livreurId, r); }

    @DeleteMapping("/{affectationId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void retirer(@PathVariable Long livreurId, @PathVariable Long affectationId) { service.retirer(livreurId, affectationId); }
}
