package com.fleetpulse.livraison.Controller;

import com.fleetpulse.livraison.Dto.BiDto.*;
import com.fleetpulse.livraison.Service.*;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController @RequiredArgsConstructor @RequestMapping("/api/admin/bi") @PreAuthorize("hasRole('OPERATIONS')")
public class BiOperationsController {
    private final BiOperationsService operations;
    private final BiPartenaireService partenaires;
    private final BiCoursierService coursiers;
    @GetMapping("/operations") public OperationsVue operations(@RequestParam(required = false) LocalDate debut,
            @RequestParam(required = false) LocalDate fin, @RequestParam(required = false) Long zoneId) {
        return operations.dashboard(PeriodeBi.de(debut, fin), zoneId);
    }
    @GetMapping("/partenaires") public PartenairesVue partenaires(@RequestParam(required = false) LocalDate debut,
            @RequestParam(required = false) LocalDate fin, @RequestParam(required = false) Long zoneId) {
        return partenaires.dashboard(PeriodeBi.de(debut, fin), zoneId);
    }
    @GetMapping("/coursiers") public CoursiersVue coursiers(@RequestParam(required = false) LocalDate debut,
            @RequestParam(required = false) LocalDate fin, @RequestParam(required = false) Long zoneId) {
        return coursiers.dashboard(PeriodeBi.de(debut, fin), zoneId);
    }
}
