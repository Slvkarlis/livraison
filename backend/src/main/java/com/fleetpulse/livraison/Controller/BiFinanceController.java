package com.fleetpulse.livraison.Controller;

import com.fleetpulse.livraison.Dto.BiDto.FinanceVue;
import com.fleetpulse.livraison.Service.*;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController @RequiredArgsConstructor @RequestMapping("/api/admin/finance/bi") @PreAuthorize("hasRole('FINANCE')")
public class BiFinanceController {
    private final BiFinanceService service;
    @GetMapping public FinanceVue dashboard(@RequestParam(required = false) LocalDate debut, @RequestParam(required = false) LocalDate fin) {
        return service.dashboard(PeriodeBi.de(debut, fin));
    }
}
