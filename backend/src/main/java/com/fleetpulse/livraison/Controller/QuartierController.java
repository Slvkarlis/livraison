package com.fleetpulse.livraison.Controller;

import com.fleetpulse.livraison.Dto.QuartierDto.*;
import com.fleetpulse.livraison.Service.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController @Tag(name = "Livraison de quartier")
public class QuartierController {
    @Autowired private QuartierService quartier;
    @Autowired private ParametresDispatch parametres;
    @Autowired private SimulateurLots simulateur;
    @Autowired private PaiementQuartierService cartes;

    @GetMapping("/api/quartier/carte") @PreAuthorize("hasRole('CLIENT')")
    @Operation(summary = "Disponibilité du paiement carte", description = "Vrai uniquement si le prestataire Stripe est configuré ; aucune clé n'est exposée.")
    public java.util.Map<String, Boolean> carte() { return java.util.Map.of("active", cartes.actif()); }
    @PostMapping("/api/commandes/{id}/carte/confirmer") @PreAuthorize("hasRole('CLIENT')")
    @Operation(summary = "Vérifier l'autorisation carte chez Stripe", description = "Le serveur interroge Stripe ; la capture au prix final attend la fermeture du groupe. Jamais de paiement déclaré par le client.")
    public com.fleetpulse.livraison.Dto.LivraisonResponse carte(Authentication a, @PathVariable Long id) { return cartes.confirmer(a.getName(), id); }

    @PostMapping("/api/admin/simulateur/quartier") @PreAuthorize("hasRole('OPERATIONS')")
    @Operation(summary = "Comparer sans lots, lots et lots avec quartier", description = "Même liste de demandes, adhésion entre 0 et 1. Invitations simulées déterministes ; km, coût, productivité, ponctualité et frais client.")
    public SimulationQuartier.Comparaison simuler(@RequestBody SimulationQuartier.Scenario s) { return simulateur.comparerQuartier(s); }

    @GetMapping("/api/quartier/groupes-proches") @PreAuthorize("hasRole('CLIENT')")
    @Operation(summary = "Groupes ouverts proches d'une de ses adresses", description = "Adresse appartenant au client ; offre, nombre de membres et expiration sans identité ni position des voisins.")
    public List<GroupeProche> proches(Authentication a, @RequestParam Long adresseId) { return quartier.proches(a.getName(), adresseId); }
    @GetMapping("/api/quartier/preference") @PreAuthorize("hasRole('CLIENT')")
    @Operation(summary = "Lire sa préférence d'invitations de quartier", description = "Préférence du client connecté, activée par défaut pour les comptes existants et nouveaux.")
    public Preference preference(Authentication a) { return quartier.preference(a.getName()); }
    @PutMapping("/api/quartier/preference") @PreAuthorize("hasRole('CLIENT')")
    @Operation(summary = "Activer ou désactiver les invitations (deux par jour au maximum)", description = "Modifie uniquement le profil du client connecté ; désactiver empêche les prochaines invitations push et WebSocket.")
    public Preference preference(Authentication a, @RequestBody Preference r) { return quartier.preference(a.getName(), r); }
    @GetMapping("/api/admin/quartier/groupes") @PreAuthorize("hasRole('OPERATIONS')")
    @Operation(summary = "Superviser les 500 groupes les plus récents", description = "Le point central privé n'est visible que des responsables opérations.")
    public List<GroupeAdmin> groupes() { return quartier.lister(); }
    @GetMapping("/api/admin/quartier/statistiques") @PreAuthorize("hasRole('OPERATIONS')")
    @Operation(summary = "Ouverts, fermés, remplissage et économies estimées en km et DT", description = "Remplissage des groupes fermés sur une capacité de trois ; économies de trajet estimées, sans réduction de la rémunération coursier.")
    public Statistiques statistiques() { return quartier.statistiques(); }
    @GetMapping("/api/admin/quartier/commerces") @PreAuthorize("hasRole('OPERATIONS')")
    @Operation(summary = "Commerces et activation des groupes", description = "Liste des commerces et du drapeau groupesQuartierActifs pour le responsable opérations.")
    public List<Commerce> commerces() { return quartier.commerces(); }
    @PutMapping("/api/admin/quartier/commerces/{id}") @PreAuthorize("hasRole('OPERATIONS')")
    @Operation(summary = "Activer la livraison de quartier pour un commerce", description = "Activation pour les prochaines commandes. Les groupes déjà ouverts conservent leur fenêtre et leurs prix acquis.")
    public Commerce activer(@PathVariable Long id, @RequestBody Activation r) { return quartier.activer(id, r); }
    @GetMapping("/api/admin/quartier/parametres") @PreAuthorize("hasRole('OPERATIONS')")
    @Operation(summary = "Paramètres app.quartier utilisés par le dispatch", description = "Rayon, fenêtre, préparation, promesse et taux applicables aux prochains groupes ; modification admin persistée en base.")
    public ParametresQuartier.Reglages parametres() { return parametres.quartier(); }
    @PutMapping("/api/admin/quartier/parametres") @PreAuthorize("hasRole('OPERATIONS')")
    @Operation(summary = "Modifier les prochains groupes", description = "Modification persistée en base, prioritaire sur app.quartier.* au redémarrage. Les offres en cours gardent leurs taux.")
    public ParametresQuartier.Reglages parametres(@RequestBody ParametresQuartier.Reglages r) { return parametres.modifierQuartier(r); }
}
