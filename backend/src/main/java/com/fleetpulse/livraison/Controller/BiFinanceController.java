package com.fleetpulse.livraison.Controller;

import com.fleetpulse.livraison.Dto.BiDto.FinanceVue;
import com.fleetpulse.livraison.Service.*;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController @RequiredArgsConstructor @RequestMapping("/api/admin/finance/bi") @PreAuthorize("hasRole('FINANCE')")
@io.swagger.v3.oas.annotations.tags.Tag(name = "BI Finance", description = "Agrégats du ledger et état actuel des encaissements ; FINANCE ou administrateur principal.")
public class BiFinanceController {
    private final BiFinanceService service;
    @GetMapping
    @io.swagger.v3.oas.annotations.Operation(summary = "Consulter le dashboard Finance", description = "Flux par date d'écriture : GMV articles, commissions, marge frais moins rémunérations, paiements enregistrés. Soldes actuels pour la cohorte livrée sur la période : cash non déposé, reversements éligibles et rémunérations en attente. Dates incluses Africa/Tunis, 366 jours maximum.")
    public FinanceVue dashboard(@RequestParam(required = false) LocalDate debut, @RequestParam(required = false) LocalDate fin) {
        return service.dashboard(PeriodeBi.de(debut, fin));
    }
}
