package com.fleetpulse.livraison.Controller;

import com.fleetpulse.livraison.Dto.AlerteDto.*;
import com.fleetpulse.livraison.Model.enums.TypeAlerte;
import com.fleetpulse.livraison.Service.AlerteService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController @RequiredArgsConstructor @RequestMapping("/api/admin/finance/bi") @PreAuthorize("hasRole('FINANCE')")
@io.swagger.v3.oas.annotations.tags.Tag(name = "Alertes Finance", description = "Cash détenu par coursier ; FINANCE ou administrateur principal.")
public class AlertesFinanceController {
    private final AlerteService service;
    @GetMapping("/seuils")
    @io.swagger.v3.oas.annotations.Operation(summary = "Lire le seuil de cash coursier", description = "Seuil global de cash détenu par coursier, valeur par défaut 500 DT ; configurable de 0 à 1 000 000 DT.")
    public List<SeuilVue> seuils() { return service.seuils(true); }
    @PutMapping("/seuils/{type}")
    @io.swagger.v3.oas.annotations.Operation(summary = "Modifier le seuil de cash coursier", description = "CASH_COURSIER uniquement, montant positif ou nul, trois décimales ; actif obligatoire. Valeurs avant/après inscrites au journal d'audit. Autres types interdits (403).")
    public SeuilVue modifier(@PathVariable TypeAlerte type, @RequestBody DemandeSeuil r) { return service.modifier(true, type, r); }
    @GetMapping("/alertes")
    @io.swagger.v3.oas.annotations.Operation(summary = "Actualiser les alertes de cash actives", description = "Somme actuelle des encaissements non déposés par coursier, strictement supérieure au seuil. Évaluation sérialisée, déduplication par coursier et résolution après dépôt ou changement de seuil.")
    public List<AlerteVue> alertes() { return service.actualiser(true); }
}
