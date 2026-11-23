package com.fleetpulse.livraison.Controller;

import com.fleetpulse.livraison.Service.GuidageService;
import com.fleetpulse.livraison.Service.GuidageService.Guidage;
import com.fleetpulse.livraison.Service.PiloteService;
import com.fleetpulse.livraison.Service.PiloteService.KpiPilote;
import com.fleetpulse.livraison.Service.PiloteService.ZonePilote;
import com.fleetpulse.livraison.Service.SimulateurLots;
import com.fleetpulse.livraison.Service.SimulateurLots.Resultat;
import com.fleetpulse.livraison.Service.SimulateurLots.Scenario;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** Sprint 7 : guidage du coursier (US-307), simulateur de lots (US-518) et pilote (US-519). */
@RestController @RequiredArgsConstructor
@Tag(name = "Guidage, simulation et pilote", description = "Itinéraire du coursier, calibrage des lots et suivi du pilote.")
public class SprintSeptController {
    private final GuidageService guidage;
    private final SimulateurLots simulateur;
    private final PiloteService pilote;

    @GetMapping("/api/livreur/missions/{id}/guidage")
    @PreAuthorize("hasRole('LIVREUR')")
    @Operation(summary = "Guidage vers le commerce puis vers le client", description = "Phase COLLECTE avant la prise en charge, LIVRAISON ensuite. Distance et durée par OSRM si configuré, sinon estimation.")
    public Guidage guidage(Authentication a, @PathVariable Long id) { return guidage.guidage(a.getName(), id); }

    @PostMapping("/api/admin/simulateur/lots")
    @PreAuthorize("hasRole('OPERATIONS')")
    @Operation(summary = "Simuler les lots contre le dispatch unitaire", description = "Compare, pour un jeu de commandes donné, le dispatch unitaire et les lots sur une grille de rayons et de fenêtres. Aucune commande réelle n'est modifiée.")
    public Resultat simuler(@RequestBody Scenario s) { return simulateur.simuler(s); }

    @GetMapping("/api/admin/pilote/zones")
    @PreAuthorize("hasRole('OPERATIONS')")
    @Operation(summary = "Lister les zones et le pilote")
    public List<ZonePilote> zones() { return pilote.zones(); }

    @PutMapping("/api/admin/pilote/zones/{id}")
    @PreAuthorize("hasRole('OPERATIONS')")
    @Operation(summary = "Ajouter ou retirer une zone du pilote", description = "Trois zones au plus. Journalisé.")
    public ZonePilote definir(@PathVariable Long id, @RequestBody Map<String, Boolean> corps) {
        return pilote.definir(id, Boolean.TRUE.equals(corps.get("pilote")));
    }

    @GetMapping("/api/admin/pilote/kpi")
    @PreAuthorize("hasRole('OPERATIONS')")
    @Operation(summary = "Indicateurs du pilote", description = "Commandes, livraisons, échecs, expirations, délai moyen et respect des ETA par zone pilote, depuis la date donnée (30 jours par défaut).")
    public List<KpiPilote> kpi(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant depuis) {
        return pilote.kpi(depuis);
    }
}
