package com.fleetpulse.livraison.Controller;

import com.fleetpulse.livraison.Dto.FinanceDto.*;
import com.fleetpulse.livraison.Model.enums.TypeEcriture;
import com.fleetpulse.livraison.Service.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

// Sprint 5 : chaine financiere, sous-role FINANCE (ou administrateur principal)
@RestController @RequestMapping("/api/admin/finance") @RequiredArgsConstructor @PreAuthorize("hasRole('FINANCE')")
@Tag(name = "Finance", description = "Commissions, barèmes de rémunération, ledger immuable, cash des livreurs, dépôts et closing hebdomadaire.")
@ApiResponses({
    @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré ; la réponse de sécurité peut être sans corps."),
    @ApiResponse(responseCode = "403", description = "Rôle insuffisant : réservé au sous-rôle FINANCE et à l’administrateur principal.")
})
public class FinanceController {
    private final CommissionService commissions;
    private final BaremeService baremes;
    private final ComptabiliteService comptabilite;
    private final CaisseService caisses;
    private final ClosingService closings;

    // ---------------------------------------------------------------- US-502
    @GetMapping("/commissions")
    @Operation(summary = "Lister les taux de commission", description = "Taux global (12 % par défaut), par catégorie et par partenaire ; le plus spécifique s’applique à la livraison.")
    public CommissionsVue commissions() { return commissions.lister(); }

    @PutMapping("/commissions")
    @Operation(summary = "Définir un taux de commission", description = "Crée ou remplace le taux d’une portée : GLOBAL, CATEGORIE (categorie) ou PARTENAIRE (partenaireId). Taux en %, de 0 à 100, deux décimales. Sans effet sur les commandes déjà livrées.")
    public TauxVue definirCommission(Authentication a, @RequestBody TauxRequest r) { return commissions.definir(a.getName(), r); }

    @DeleteMapping("/commissions/{id}")
    @Operation(summary = "Supprimer un taux de commission", description = "Le taux plus général s’applique ensuite (catégorie, puis global, puis 12 %).")
    public ResponseEntity<Void> supprimerCommission(@PathVariable Long id) {
        commissions.supprimer(id);
        return ResponseEntity.noContent().build();
    }

    // ---------------------------------------------------------------- US-512
    @GetMapping("/baremes")
    @Operation(summary = "Lister les barèmes de rémunération", description = "Pour chaque zone : base par mission et prix par km ; parDefaut si la zone n’a pas de barème (3 DT + 0,5 DT/km).")
    public List<BaremeVue> baremes() { return baremes.lister(); }

    @PutMapping("/baremes/{id}")
    @Operation(summary = "Définir le barème d’une zone", description = "id : zone. Montants positifs, trois décimales. S’applique aux missions livrées ensuite.")
    public BaremeVue definirBareme(Authentication a, @PathVariable Long id, @RequestBody BaremeRequest r) { return baremes.definir(a.getName(), id, r); }

    // ---------------------------------------------------------------- US-501 / US-503
    @GetMapping("/ledger")
    @Operation(summary = "Consulter le ledger", description = "Écritures immuables, des plus récentes aux plus anciennes, filtrées par commande, partenaire, livreur, type ou date ; 200 par défaut, 1000 au plus.")
    public List<EcritureVue> ledger(@RequestParam(required = false) Long commandeId, @RequestParam(required = false) Long partenaireId,
                                    @RequestParam(required = false) Long livreurId, @RequestParam(required = false) TypeEcriture type,
                                    @RequestParam(required = false) Instant depuis, @RequestParam(required = false) Integer limite) {
        return comptabilite.ecritures(commandeId, partenaireId, livreurId, type, depuis, limite);
    }

    @GetMapping("/commandes/{id}")
    @Operation(summary = "Détail financier d’une commande", description = "Montants figés à la livraison (commission, net partenaire, frais, cash, rémunération), reçu de dépôt, closings et écritures.")
    public FinanceCommandeVue commande(@PathVariable Long id) { return comptabilite.detail(id); }

    // ---------------------------------------------------------------- US-505
    @GetMapping("/caisses")
    @Operation(summary = "Cash en circulation", description = "Solde de chaque livreur (cash encaissé non déposé), du plus élevé au plus faible, et total.")
    public CaissesVue caisses() { return caisses.caisses(); }

    @GetMapping("/caisses/{id}")
    @Operation(summary = "Caisse d’un livreur", description = "id : livreur. Commandes encaissées à déposer et reçus de ses dépôts.")
    public CaisseCoursierVue caisse(@PathVariable Long id) { return caisses.caisse(id); }

    @PostMapping("/depots")
    @Operation(summary = "Enregistrer un dépôt de cash", description = "Dépôt intégral : rapproche toutes les commandes encaissées du livreur et génère un reçu. Un montant différent du solde exige motifEcart. cleIdempotence (8 à 80 caractères) : rejouer le même dépôt renvoie le même reçu.")
    @ApiResponse(responseCode = "201", description = "Reçu du dépôt.")
    @ApiResponse(responseCode = "409", description = "Aucun cash à déposer, ou clé déjà utilisée pour un autre dépôt.")
    public ResponseEntity<RecuVue> deposer(Authentication a, @RequestBody DepotRequest r) {
        return ResponseEntity.status(HttpStatus.CREATED).body(caisses.deposer(a.getName(), r));
    }

    @GetMapping("/depots")
    @Operation(summary = "Lister les reçus de dépôt", description = "Les 100 derniers reçus, ou ceux d’un livreur (livreurId).")
    public List<RecuVue> depots(@RequestParam(required = false) Long livreurId) { return caisses.recus(livreurId, false); }

    @GetMapping("/depots/{id}")
    @Operation(summary = "Consulter un reçu", description = "Reçu avec la liste des commandes rapprochées.")
    public RecuVue depot(@PathVariable Long id) { return caisses.recu(id); }

    // ---------------------------------------------------------------- US-506 / US-512
    @GetMapping("/closings/apercu")
    @Operation(summary = "Prévisualiser un closing", description = "semaine : un jour de la semaine (ISO 8601, défaut : aujourd’hui). Relevés de reversement (cash rapproché uniquement) et de rémunération, sans rien enregistrer ; closing existant s’il est déjà validé.")
    public ClosingVue apercu(@RequestParam(required = false) LocalDate semaine) { return closings.apercu(semaine); }

    @PostMapping("/closings")
    @Operation(summary = "Valider le closing d’une semaine", description = "Semaine terminée uniquement, une seule fois. Enregistre les relevés partenaires et livreurs, marque les commandes et écrit les reversements et paiements au ledger.")
    @ApiResponse(responseCode = "201", description = "Closing validé.")
    @ApiResponse(responseCode = "409", description = "Semaine en cours ou déjà clôturée.")
    public ResponseEntity<ClosingVue> valider(Authentication a, @RequestBody ClosingRequest r) {
        return ResponseEntity.status(HttpStatus.CREATED).body(closings.valider(a.getName(), r));
    }

    @GetMapping("/closings")
    @Operation(summary = "Lister les closings", description = "Du plus récent au plus ancien, avec leurs relevés.")
    public List<ClosingVue> closings() { return closings.lister(); }

    @GetMapping("/closings/{id}")
    @Operation(summary = "Consulter un closing", description = "Relevés de reversement par partenaire et de rémunération par livreur.")
    public ClosingVue closing(@PathVariable Long id) { return closings.detail(id); }
}
