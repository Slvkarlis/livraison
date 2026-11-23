package com.fleetpulse.livraison.Controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;

import com.fleetpulse.livraison.Dto.EchecDto.EchecRequest;
import com.fleetpulse.livraison.Dto.EspaceLivreurDto.*;
import com.fleetpulse.livraison.Service.EchecService;
import com.fleetpulse.livraison.Service.EspaceLivreurService;
import com.fleetpulse.livraison.Service.RemiseLivreurService;
import com.fleetpulse.livraison.Service.SuiviPositionService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

// US-2B8 : espace du coursier connecte (disponibilite et missions de collecte)
@RestController @RequestMapping("/api/livreur") @RequiredArgsConstructor @PreAuthorize("hasRole('LIVREUR')")
@Tag(name = "Missions livreur", description = "Disponibilité, collecte, position et remise des missions du livreur connecté.")
@ApiResponses({
    @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré ; la réponse de sécurité peut être sans corps."),
    @ApiResponse(responseCode = "403", description = "Rôle insuffisant ou accès à une ressource non autorisée.")
})
public class EspaceLivreurController {
    private final EspaceLivreurService service;
    private final SuiviPositionService suiviPosition;
    private final RemiseLivreurService remise;
    private final EchecService echecs;

    @GetMapping("/disponibilite")
    @Operation(summary = "Consulter sa disponibilité", description = "Retourne la disponibilité enregistrée et les zones autorisées actuellement en vigueur.")
    public DisponibiliteVue disponibilite(Authentication a) { return service.disponibilite(a.getName()); }

    @PutMapping("/disponibilite")
    @Operation(summary = "Changer sa disponibilité", description = "Pour devenir disponible, latitude et longitude sont obligatoires et doivent se situer dans une zone autorisée. Déclenche la recherche de commandes prêtes en attente.")
    public DisponibiliteVue changerDisponibilite(Authentication a, @RequestBody DisponibiliteRequest r) {
        return service.changerDisponibilite(a.getName(), r);
    }

    @GetMapping("/missions")
    @Operation(summary = "Lister ses missions", description = "Retourne les commandes AFFECTEE, RECUPEREE ou A_PROXIMITE attribuées à ce livreur. Maximum trois missions simultanées.")
    public List<MissionVue> missions(Authentication a) { return service.missions(a.getName()); }

    @GetMapping("/missions/livrees")
    @Operation(summary = "Retrouver ses 50 dernières livraisons", description = "Historique borné au coursier connecté, du plus récent au plus ancien ; permet de noter le client après livraison même lorsque le cash a été déposé.")
    public List<MissionVue> missionsLivrees(Authentication a) { return service.missionsLivrees(a.getName()); }

    @GetMapping("/missions/{id}")
    @Operation(summary = "Consulter une mission", description = "L’adresse exacte du client est masquée avant collecte. Une mission d’un autre livreur retourne 404.")
    public MissionVue mission(Authentication a, @PathVariable Long id) { return service.mission(a.getName(), id); }

    // US-2B9 : prise en charge du colis a la boutique (QR scanne ou code saisi)
    @PostMapping("/missions/{id}/collecte")
    @Operation(summary = "Confirmer la collecte du colis", description = "Scanne le QR de l’étiquette partenaire ou saisit son code à six caractères. Transition AFFECTEE vers RECUPEREE ; le rejeu est sans effet.")
    public MissionVue confirmerCollecte(Authentication a, @PathVariable Long id, @RequestBody CollecteRequest r) {
        return service.confirmerCollecte(a.getName(), id, r);
    }

    // US-306 : montant encaisse confirme puis QR du client scanne (ou code SMS saisi) : commande livree
    @PostMapping("/missions/{id}/remise")
    @Operation(summary = "Valider le paiement et la remise", description = "Confirmer montantEncaisse, puis preuve : QR dynamique du client ou code de secours à six chiffres. Un écart au total exige motifEcart. Transition vers LIVREE et paiement ENCAISSE.")
    public MissionVue validerRemise(Authentication a, @PathVariable Long id, @RequestBody RemiseRequest r) {
        return remise.valider(a.getName(), id, r);
    }

    // US-308 : echec de livraison declare avec motif (le colis reste en main jusqu'a la decision du responsable)
    @PostMapping("/missions/{id}/echec")
    @Operation(summary = "Déclarer un échec de livraison", description = "Motif obligatoire : INJOIGNABLE, REFUS_MARCHANDISE, REFUS_PAIEMENT, ADRESSE_INTROUVABLE ou INCIDENT (commentaire de 5 caractères minimum). Possible après collecte ; passe la commande en ECHEC. Le rejeu est sans effet.")
    public MissionVue declarerEchec(Authentication a, @PathVariable Long id, @RequestBody EchecRequest r) {
        return echecs.declarer(a.getName(), id, r);
    }

    // US-301 : position GPS envoyee par l'application pendant les missions
    @PutMapping("/position")
    @Operation(summary = "Envoyer sa position GPS", description = "Coordonnées WGS84 et précision en mètres. Un point rejeté retourne 200 avec acceptee=false et une raison. À moins de 300 m du client, déclenche A_PROXIMITE une seule fois.")
    public PositionVue position(Authentication a, @RequestBody PositionRequest r) { return suiviPosition.enregistrer(a.getName(), r); }
}
