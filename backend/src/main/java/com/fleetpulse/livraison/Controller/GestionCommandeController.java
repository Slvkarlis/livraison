package com.fleetpulse.livraison.Controller;

import com.fleetpulse.livraison.Dto.GestionCommandeDto.*;
import com.fleetpulse.livraison.Service.GestionCommandeService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

// US-311 : interventions du responsable sur une commande (sous-role operations ou administrateur principal)
@RestController @RequestMapping("/api/admin/commandes/{id}") @RequiredArgsConstructor @PreAuthorize("hasRole('OPERATIONS')")
public class GestionCommandeController {
    private final GestionCommandeService service;

    @GetMapping("/suivi")
    public SuiviResponsable suivi(@PathVariable Long id) { return service.suivi(id); }

    @PutMapping("/annuler")
    public SuiviResponsable annuler(Authentication a, @PathVariable Long id, @RequestBody MotifRequest r) {
        return service.annuler(a.getName(), id, r);
    }

    @PutMapping("/collecte")
    public SuiviResponsable validerCollecte(Authentication a, @PathVariable Long id, @RequestBody MotifRequest r) {
        return service.validerCollecte(a.getName(), id, r);
    }

    @PutMapping("/remise")
    public SuiviResponsable validerRemise(Authentication a, @PathVariable Long id, @RequestBody RemiseManuelleRequest r) {
        return service.validerRemise(a.getName(), id, r);
    }
}
