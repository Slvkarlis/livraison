package com.fleetpulse.livraison.Controller;

import com.fleetpulse.livraison.Dto.BiDto.*;
import com.fleetpulse.livraison.Service.*;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController @RequiredArgsConstructor @RequestMapping("/api/admin/bi") @PreAuthorize("hasRole('OPERATIONS')")
@io.swagger.v3.oas.annotations.tags.Tag(name = "BI Opérations", description = "Volumes, partenaires, coursiers et zones ; OPERATIONS ou administrateur principal.")
public class BiOperationsController {
    private final BiOperationsService operations;
    private final BiPartenaireService partenaires;
    private final BiCoursierService coursiers;
    @GetMapping("/operations")
    @io.swagger.v3.oas.annotations.Operation(summary = "Consulter volumes et couverture", description = "Statuts actuels des commandes créées sur la période, densité agrégée par zone actuelle du commerce. Couverture et disponibilités observées maintenant. Gains des lots non disponibles faute de scénario unitaire conservé. Filtre zone facultatif.")
    public OperationsVue operations(@RequestParam(required = false) LocalDate debut,
            @RequestParam(required = false) LocalDate fin, @RequestParam(required = false) Long zoneId) {
        return operations.dashboard(PeriodeBi.de(debut, fin), zoneId);
    }
    @GetMapping("/partenaires")
    @io.swagger.v3.oas.annotations.Operation(summary = "Consulter la qualité des partenaires", description = "Commandes créées sur la période : acceptations, refus et motifs, préparation annoncée/réelle sur échantillon commun valide, notes et classement. Expiration et réclamations non disponibles. Dates incluses Africa/Tunis.")
    public PartenairesVue partenaires(@RequestParam(required = false) LocalDate debut,
            @RequestParam(required = false) LocalDate fin, @RequestParam(required = false) Long zoneId) {
        return partenaires.dashboard(PeriodeBi.de(debut, fin), zoneId);
    }
    @GetMapping("/coursiers")
    @io.swagger.v3.oas.annotations.Operation(summary = "Consulter coursiers et productivité des zones", description = "Missions livrées comptabilisées dans la période : minutes/km estimé, ETA, délai moyen de dépôt, nombre d'écarts, notes croisées et productivité par zone figée. Dénominateurs et mesures absentes explicites ; aucun montant de cash exposé à OPERATIONS.")
    public CoursiersVue coursiers(@RequestParam(required = false) LocalDate debut,
            @RequestParam(required = false) LocalDate fin, @RequestParam(required = false) Long zoneId) {
        return coursiers.dashboard(PeriodeBi.de(debut, fin), zoneId);
    }
}
