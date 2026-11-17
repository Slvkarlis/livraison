package com.fleetpulse.livraison.Controller;

import com.fleetpulse.livraison.Dto.DispatchDto.*;
import com.fleetpulse.livraison.Service.DispatchService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

// Sprint 4 (US-404, US-405) : offres de lots proposees au coursier connecte et itineraire de ses lots
@RestController @RequestMapping("/api/livreur") @RequiredArgsConstructor @PreAuthorize("hasRole('LIVREUR')")
@Tag(name = "Offres de lots", description = "Offres de lots (2 à 3 collectes) à accepter ou refuser dans le délai, et itinéraire ordonné des lots acceptés.")
@ApiResponses({
    @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré ; la réponse de sécurité peut être sans corps."),
    @ApiResponse(responseCode = "403", description = "Rôle insuffisant ou accès à une ressource non autorisée.")
})
public class OffreLivreurController {
    private final DispatchService dispatch;

    @GetMapping("/offres")
    @Operation(summary = "Lister ses offres en attente", description = "Offres non expirées avec l'itinéraire proposé, le montant total à encaisser et le signal hors zone (débordement depuis une zone voisine).")
    public List<OffreVue> offres(Authentication a) { return dispatch.offres(a.getName()); }

    @PutMapping("/offres/{id}/accepter")
    @Operation(summary = "Accepter une offre de lot", description = "Avant expireLe et en étant disponible. Les commandes encore prêtes passent AFFECTEE pour ce livreur ; l'itinéraire est recalculé depuis sa position. Rejouer l'acceptation est sans effet ; offre expirée ou reprise : 409.")
    @ApiResponse(responseCode = "409", description = "Offre expirée, déjà traitée, commandes plus à livrer ou trop de missions en cours.")
    public LotVue accepter(Authentication a, @PathVariable Long id) { return dispatch.accepter(a.getName(), id); }

    @PutMapping("/offres/{id}/refuser")
    @Operation(summary = "Refuser une offre de lot", description = "Motif facultatif (300 caractères maximum). Le lot est aussitôt reproposé à un autre livreur ; ce livreur ne le reverra plus.")
    public ResponseEntity<Void> refuser(Authentication a, @PathVariable Long id, @RequestBody(required = false) RefusOffreRequest r) {
        dispatch.refuser(a.getName(), id, r);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/lots")
    @Operation(summary = "Consulter ses lots en cours", description = "Lots acceptés dont une commande est encore en mission, avec l'ordre des collectes et des livraisons (US-404). L'adresse du client apparaît après la collecte.")
    public List<LotVue> lots(Authentication a) { return dispatch.lotsEnCours(a.getName()); }
}
