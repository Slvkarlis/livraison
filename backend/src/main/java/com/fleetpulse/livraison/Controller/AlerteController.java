package com.fleetpulse.livraison.Controller;

import com.fleetpulse.livraison.Dto.AlerteDto.*;
import com.fleetpulse.livraison.Model.enums.TypeAlerte;
import com.fleetpulse.livraison.Service.AlerteService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController @RequiredArgsConstructor @RequestMapping("/api/admin/bi") @PreAuthorize("hasRole('OPERATIONS')")
@io.swagger.v3.oas.annotations.tags.Tag(name = "Alertes Opérations", description = "Seuils et alertes opérationnels ; cash réservé aux routes FINANCE.")
public class AlerteController {
    private final AlerteService service;
    @GetMapping("/seuils")
    @io.swagger.v3.oas.annotations.Operation(summary = "Lire les seuils opérationnels", description = "Refus partenaire, retard ETA, couverture et attente sans coursier. Valeurs, unités, maximums et activation.")
    public List<SeuilVue> seuils() { return service.seuils(false); }
    @PutMapping("/seuils/{type}")
    @io.swagger.v3.oas.annotations.Operation(summary = "Modifier un seuil opérationnel", description = "Valeur entre zéro et le maximum du type, trois décimales ; actif obligatoire. Modification auditée. CASH_COURSIER interdit sur cette route (403).")
    public SeuilVue modifier(@PathVariable TypeAlerte type, @RequestBody DemandeSeuil r) { return service.modifier(false, type, r); }
    @GetMapping("/alertes")
    @io.swagger.v3.oas.annotations.Operation(summary = "Actualiser les alertes opérationnelles actives", description = "État actuel indépendant de la période BI ; évalue les seuils, résout les conditions disparues et conserve une seule ligne par type/objet. Date de premier déclenchement, dernière observation et valeur/seuil.")
    public List<AlerteVue> alertes() { return service.actualiser(false); }
}
