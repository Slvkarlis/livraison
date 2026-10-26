package com.fleetpulse.livraison.Controller;

import com.fleetpulse.livraison.Dto.CompteResponse;
import com.fleetpulse.livraison.Dto.CreateResponsableRequest;
import com.fleetpulse.livraison.Dto.JournalAuditResponse;
import com.fleetpulse.livraison.Dto.MotifRequest;
import com.fleetpulse.livraison.Model.enums.ActionAudit;
import com.fleetpulse.livraison.Model.enums.Role;
import com.fleetpulse.livraison.Model.enums.StatutCompte;
import com.fleetpulse.livraison.Service.AuditService;
import com.fleetpulse.livraison.Service.CompteService;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Gestion des comptes par le Responsable (sous-role OPERATIONS ou administrateur principal). */
@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('OPERATIONS')")
public class CompteController {
    @Autowired
    private CompteService compteService;
    @Autowired
    private AuditService auditService;

    @GetMapping("/comptes")
    public List<CompteResponse> comptes(@RequestParam(required = false) Role role,
                                        @RequestParam(required = false) StatutCompte statut) {
        return compteService.lister(role, statut);
    }

    @GetMapping("/comptes/{id}")
    public CompteResponse compte(@PathVariable Long id) {
        return compteService.detail(id);
    }

    // US-105 / US-106 : dossiers partenaires et livreurs a traiter
    @GetMapping("/dossiers")
    public List<CompteResponse> dossiers() {
        return compteService.dossiersOuverts();
    }

    @PutMapping("/dossiers/{id}/valider")
    public CompteResponse valider(@PathVariable Long id) {
        return compteService.valider(id);
    }

    @PutMapping("/dossiers/{id}/refuser")
    public CompteResponse refuser(@PathVariable Long id, @RequestBody MotifRequest request) {
        return compteService.refuser(id, request.motif());
    }

    @PutMapping("/dossiers/{id}/complement")
    public CompteResponse demanderComplement(@PathVariable Long id, @RequestBody MotifRequest request) {
        return compteService.demanderComplement(id, request.motif());
    }

    // US-109
    @PutMapping("/comptes/{id}/suspendre")
    public CompteResponse suspendre(@PathVariable Long id, @RequestBody MotifRequest request,
                                    Authentication authentication) {
        return compteService.suspendre(id, request.motif(), authentication);
    }

    @PutMapping("/comptes/{id}/reactiver")
    public CompteResponse reactiver(@PathVariable Long id, @RequestBody MotifRequest request,
                                    Authentication authentication) {
        return compteService.reactiver(id, request.motif(), authentication);
    }

    // US-103 : seul l'administrateur principal cree les comptes OPERATIONS / FINANCE
    @PostMapping("/responsables")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<CompteResponse> creerResponsable(@RequestBody CreateResponsableRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(compteService.creerResponsable(request));
    }

    // US-108 : consultable par tous les Responsables, finance comprise
    @GetMapping("/audit")
    @PreAuthorize("hasRole('RESPONSABLE')")
    public List<JournalAuditResponse> audit(@RequestParam(required = false) String acteur,
                                            @RequestParam(required = false) ActionAudit action,
                                            @RequestParam(required = false) Long cibleId,
                                            @RequestParam(required = false) Integer limite) {
        return auditService.rechercher(acteur, action, cibleId, limite);
    }
}
