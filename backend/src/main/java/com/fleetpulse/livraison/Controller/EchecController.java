package com.fleetpulse.livraison.Controller;

import com.fleetpulse.livraison.Dto.EchecDto.*;
import com.fleetpulse.livraison.Service.EchecService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** US-312 : traitement des echecs par le responsable (sous-role OPERATIONS ou administrateur principal). */
@RestController @RequestMapping("/api/admin/echecs") @RequiredArgsConstructor @PreAuthorize("hasRole('OPERATIONS')")
@Tag(name = "Echecs de livraison", description = "Décision du responsable sur les commandes en échec : relivraison, retour au partenaire ou perte.")
public class EchecController {
    private final EchecService service;

    @GetMapping
    @Operation(summary = "Lister les échecs", description = "Commandes au statut ECHEC, les plus récentes d'abord, avec motif et décision éventuelle.")
    public List<EchecVue> lister() { return service.echecs(); }

    @PostMapping("/{id}/decision")
    @Operation(summary = "Décider du sort d'un échec", description = "RELIVRAISON repasse la commande en RECUPEREE ; RETOUR_PARTENAIRE la passe en RETOURNEE ; PERTE trace la perte. Une seule décision par échec : 409 ensuite.")
    public EchecVue decider(Authentication a, @PathVariable Long id, @RequestBody DecisionRequest r) {
        return service.decider(a.getName(), id, r);
    }
}
