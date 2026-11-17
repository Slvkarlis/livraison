package com.fleetpulse.livraison.Controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;

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
import java.time.Instant;
import com.fleetpulse.livraison.Dto.PageAuditResponse;
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
@Tag(name = "Comptes et audit", description = "Gestion des comptes et dossiers ; la connexion et les mots de passe restent hors du périmètre du TP.")
@ApiResponses({
    @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré ; la réponse de sécurité peut être sans corps."),
    @ApiResponse(responseCode = "403", description = "Rôle insuffisant ou accès à une ressource non autorisée.")
})
public class CompteController {
    @Autowired
    private CompteService compteService;
    @Autowired
    private AuditService auditService;

    @GetMapping("/comptes")
    @Operation(summary = "Lister les comptes", description = "Filtres facultatifs role et statut. Réservé à OPERATIONS.")
    public List<CompteResponse> comptes(@RequestParam(required = false) Role role,
                                        @RequestParam(required = false) StatutCompte statut) {
        return compteService.lister(role, statut);
    }

    @GetMapping("/comptes/{id}")
    @Operation(summary = "Consulter un compte", description = "Données du compte et de son dossier ; aucun mot de passe ni hash n’est exposé.")
    public CompteResponse compte(@PathVariable Long id) {
        return compteService.detail(id);
    }

    // US-105 / US-106 : dossiers partenaires et livreurs a traiter
    @GetMapping("/dossiers")
    @Operation(summary = "Lister les candidatures à traiter", description = "Retourne les dossiers en attente ou nécessitant un complément.")
    public List<CompteResponse> dossiers() {
        return compteService.dossiersOuverts();
    }

    @PutMapping("/dossiers/{id}/valider")
    @Operation(summary = "Valider une candidature", description = "Active le compte candidat et inscrit la décision dans le journal d’audit.")
    public CompteResponse valider(@PathVariable Long id) {
        return compteService.valider(id);
    }

    @PutMapping("/dossiers/{id}/refuser")
    @Operation(summary = "Refuser une candidature", description = "Le motif est obligatoire et conservé dans le dossier.")
    public CompteResponse refuser(@PathVariable Long id, @RequestBody MotifRequest request) {
        return compteService.refuser(id, request.motif());
    }

    @PutMapping("/dossiers/{id}/complement")
    @Operation(summary = "Demander un complément", description = "Indique au candidat les informations à corriger ; un motif explicite est obligatoire.")
    public CompteResponse demanderComplement(@PathVariable Long id, @RequestBody MotifRequest request) {
        return compteService.demanderComplement(id, request.motif());
    }

    // US-109
    @PutMapping("/comptes/{id}/suspendre")
    @Operation(summary = "Suspendre un compte", description = "Motif obligatoire. La suspension coupe les accès du compte ; les protections des comptes responsables sont vérifiées côté service.")
    public CompteResponse suspendre(@PathVariable Long id, @RequestBody MotifRequest request,
                                    Authentication authentication) {
        return compteService.suspendre(id, request.motif(), authentication);
    }

    @PutMapping("/comptes/{id}/reactiver")
    @Operation(summary = "Réactiver un compte", description = "Motif obligatoire et action auditée ; les droits du responsable sont vérifiés côté service.")
    public CompteResponse reactiver(@PathVariable Long id, @RequestBody MotifRequest request,
                                    Authentication authentication) {
        return compteService.reactiver(id, request.motif(), authentication);
    }

    // US-103 : seul l'administrateur principal cree les comptes OPERATIONS / FINANCE
    @PostMapping("/responsables")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Créer un responsable", description = "Réservé à l’administrateur principal. Le sous-rôle est OPERATIONS ou FINANCE.")
    public ResponseEntity<CompteResponse> creerResponsable(@RequestBody CreateResponsableRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(compteService.creerResponsable(request));
    }

    // US-108 : consultable par tous les Responsables, finance comprise
    @GetMapping("/audit")
    @PreAuthorize("hasRole('RESPONSABLE')")
    @Operation(summary = "Consulter le journal d’audit", description = "Consultation historique limitée à 500 événements. Préférer /audit/page pour une pagination complète.")
    public List<JournalAuditResponse> auditLegacy(@RequestParam(required = false) String acteur,
                                            @RequestParam(required = false) ActionAudit action,
                                            @RequestParam(required = false) Long cibleId,
                                            @RequestParam(required = false) Integer limite) {
        return auditService.rechercher(acteur, action, cibleId, limite);
    }

    @GetMapping("/audit/page")
    @PreAuthorize("hasRole('RESPONSABLE')")
    @Operation(summary = "Consulter le journal d’audit paginé", description = "page commence à 0 ; taille de 1 à 100. Dates ISO 8601, début inclus et fin exclue. Accessible aussi au rôle FINANCE.")
    public PageAuditResponse audit(@RequestParam(required = false) String acteur,
                                            @RequestParam(required = false) ActionAudit action,
                                            @RequestParam(required = false) Instant debut,
                                            @RequestParam(required = false) Instant fin,
                                            @RequestParam(defaultValue = "0") int page,
                                            @RequestParam(defaultValue = "20") int taille) {
        return PageAuditResponse.from(auditService.page(acteur, action, debut, fin, page, taille));
    }
}
