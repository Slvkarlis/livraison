package com.fleetpulse.livraison.Controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;

import com.fleetpulse.livraison.Dto.CommandePartenaireDto.*;
import com.fleetpulse.livraison.Model.enums.StatutLivraison;
import com.fleetpulse.livraison.Service.CommandePartenaireService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/partenaire/commandes") @RequiredArgsConstructor @PreAuthorize("hasRole('PARTENAIRE')")
@Tag(name = "Commandes partenaire", description = "Gestion des commandes reçues par le partenaire connecté.")
@ApiResponses({
    @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré ; la réponse de sécurité peut être sans corps."),
    @ApiResponse(responseCode = "403", description = "Rôle insuffisant ou accès à une ressource non autorisée.")
})
public class CommandePartenaireController {
    private final CommandePartenaireService service;

    // US-2B1 : commandes recues, filtre facultatif ?statut=PENDING_PARTNER&statut=ACCEPTEE
    @GetMapping
    @Operation(summary = "Lister les commandes reçues", description = "Filtre facultatif répétable : ?statut=PENDING_PARTNER&statut=ACCEPTEE. Seules les commandes du partenaire connecté sont retournées.")
    public List<CommandeResume> lister(Authentication a, @RequestParam(required = false) List<StatutLivraison> statut) {
        return service.lister(a.getName(), statut);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Consulter une commande reçue", description = "Articles, délais et historique. Une commande d’un autre partenaire est masquée par une réponse 404.")
    public CommandeDetail detail(Authentication a, @PathVariable Long id) { return service.detail(a.getName(), id); }

    // US-2B2 : decision du partenaire sur une commande PENDING_PARTNER
    @PutMapping("/{id}/accepter")
    @Operation(summary = "Accepter une commande", description = "Depuis PENDING_PARTNER : annoncer un temps de préparation de 1 à 180 minutes. Rejouer la même décision est sans effet.")
    public CommandeDetail accepter(Authentication a, @PathVariable Long id, @RequestBody TempsPreparationRequest r) {
        return service.accepter(a.getName(), id, r);
    }

    @PutMapping("/{id}/refuser")
    @Operation(summary = "Refuser une commande", description = "Un motif est obligatoire ; AUTRE nécessite un commentaire de 300 caractères maximum.")
    public CommandeDetail refuser(Authentication a, @PathVariable Long id, @RequestBody RefusRequest r) {
        return service.refuser(a.getName(), id, r);
    }

    // US-2B4 : preparation (debut, nouveau delai restant au plus 2 fois)
    @PutMapping("/{id}/preparation/debut")
    @Operation(summary = "Commencer la préparation", description = "Transition ACCEPTEE vers EN_PREPARATION ; le rejeu ne crée pas une nouvelle transition.")
    public CommandeDetail commencerPreparation(Authentication a, @PathVariable Long id) {
        return service.commencerPreparation(a.getName(), id);
    }

    @PutMapping("/{id}/preparation/temps")
    @Operation(summary = "Ajuster le délai restant", description = "Délai de 1 à 180 minutes, modifiable au maximum deux fois avant que la commande soit prête.")
    public CommandeDetail ajusterPreparation(Authentication a, @PathVariable Long id, @RequestBody TempsPreparationRequest r) {
        return service.ajusterPreparation(a.getName(), id, r);
    }

    // US-2B5 : commande prete pour la collecte
    @PutMapping("/{id}/prete")
    @Operation(summary = "Marquer une commande prête", description = "Génère le code de collecte et recherche un livreur disponible dans la zone du commerce. Sans candidat, la commande attend au statut PRETE.")
    public CommandeDetail marquerPrete(Authentication a, @PathVariable Long id) { return service.marquerPrete(a.getName(), id); }

    // US-2B10 : etiquette du colis avec le QR de collecte
    @GetMapping("/{id}/etiquette")
    @Operation(summary = "Obtenir l’étiquette du colis", description = "QR de collecte du colis, disponible uniquement aux statuts PRETE et AFFECTEE. Ce QR est différent du QR de remise du client.")
    public EtiquetteColis etiquette(Authentication a, @PathVariable Long id) { return service.etiquette(a.getName(), id); }
}
