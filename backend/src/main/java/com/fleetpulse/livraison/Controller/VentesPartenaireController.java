package com.fleetpulse.livraison.Controller;

import com.fleetpulse.livraison.Dto.BiDto.VentesVue;
import com.fleetpulse.livraison.Service.*;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController @RequiredArgsConstructor @RequestMapping("/api/partenaire/ventes") @PreAuthorize("hasRole('PARTENAIRE')")
public class VentesPartenaireController {
    private final VentesPartenaireService service;
    @GetMapping public VentesVue ventes(Authentication a, @RequestParam(required = false) LocalDate debut,
            @RequestParam(required = false) LocalDate fin) {
        return service.dashboard(a.getName(), PeriodeBi.de(debut, fin));
    }
}
