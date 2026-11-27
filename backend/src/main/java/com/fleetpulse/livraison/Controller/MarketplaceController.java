package com.fleetpulse.livraison.Controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;

import com.fleetpulse.livraison.Dto.*;
import com.fleetpulse.livraison.Dto.MarketplaceDto.*;
import com.fleetpulse.livraison.Service.*;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api") @RequiredArgsConstructor
@Tag(name = "Catalogue et commandes", description = "Zones, commerces, produits, adresses et parcours de commande avec paiement à la livraison.")
@ApiResponses({
    @ApiResponse(responseCode = "401", description = "Jeton absent, invalide ou expiré ; la réponse de sécurité peut être sans corps."),
    @ApiResponse(responseCode = "403", description = "Rôle insuffisant ou accès à une ressource non autorisée.")
})
public class MarketplaceController {
    private final ZoneService zones;
    private final CatalogueService catalogue;
    private final AdresseService adresses;
    private final CommandeService commandes;
    private final SuiviCommandeService suivi;
    private final RemiseClientService remise;
    @GetMapping("/admin/zones") @PreAuthorize("hasAnyRole('ADMIN','OPERATIONS')")
    @Operation(summary = "Lister les zones de livraison", description = "Contours WGS84, frais, vitesse moyenne, partenaires couverts et zones voisines partageant un segment de frontière. Le voisinage est recalculé depuis les contours courants.")
    public List<ZoneVue> zones() { return zones.lister(); }
    @PostMapping("/admin/zones") @ResponseStatus(HttpStatus.CREATED) @PreAuthorize("hasAnyRole('ADMIN','OPERATIONS')")
    @Operation(summary = "Créer une zone", description = "Polygone de 3 à 200 sommets, sans croisement ni chevauchement. Les frontières communes sont autorisées.")
    public ZoneVue creerZone(@RequestBody ZoneRequest r) { return zones.enregistrer(null, r); }
    @PutMapping("/admin/zones/{id}") @PreAuthorize("hasAnyRole('ADMIN','OPERATIONS')")
    @Operation(summary = "Modifier une zone", description = "Met à jour le contour et les frais puis recalcule le rattachement géographique des commerces. Vitesse facultative de 5 à 80 km/h.")
    public ZoneVue modifierZone(@PathVariable Long id, @RequestBody ZoneRequest r) { return zones.enregistrer(id, r); }
    @DeleteMapping("/admin/zones/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) @PreAuthorize("hasAnyRole('ADMIN','OPERATIONS')")
    @Operation(summary = "Supprimer une zone", description = "Refus 409 si des commerces ou des livreurs sont encore rattachés à cette zone.")
    public void supprimerZone(@PathVariable Long id) { zones.supprimer(id); }
    @GetMapping("/partenaire/commerce") @PreAuthorize("hasRole('PARTENAIRE')")
    @Operation(summary = "Consulter son commerce", description = "Commerce du partenaire connecté et zone de livraison correspondante.")
    public CommerceVue moi(Authentication a) { return catalogue.moi(a.getName()); }
    @PutMapping("/partenaire/commerce") @PreAuthorize("hasRole('PARTENAIRE')")
    @Operation(summary = "Ouvrir ou fermer son commerce", description = "L’ouverture exige une zone couvrant le commerce. La fermeture empêche les nouvelles commandes.")
    public CommerceVue ouverture(Authentication a, @RequestBody CommerceRequest r) { return catalogue.ouverture(a.getName(), r); }
    @GetMapping("/partenaire/produits") @PreAuthorize("hasRole('PARTENAIRE')")
    @Operation(summary = "Lister ses produits", description = "Retourne les produits du partenaire connecté, y compris les produits indisponibles.")
    public List<ProduitVue> mesProduits(Authentication a) { return catalogue.mesProduits(a.getName()); }
    @PostMapping("/partenaire/produits") @ResponseStatus(HttpStatus.CREATED) @PreAuthorize("hasRole('PARTENAIRE')")
    @Operation(summary = "Créer un produit", description = "Nom de 1 à 120 caractères, prix strictement positif en DT avec trois décimales maximum et disponibilité obligatoire.")
    public ProduitVue creerProduit(Authentication a, @RequestBody ProduitRequest r) { return catalogue.enregistrer(a.getName(), null, r); }
    @PutMapping("/partenaire/produits/{id}") @PreAuthorize("hasRole('PARTENAIRE')")
    @Operation(summary = "Modifier un produit", description = "Modification réservée au propriétaire du catalogue. Les prix des commandes existantes restent figés.")
    public ProduitVue modifierProduit(Authentication a, @PathVariable Long id, @RequestBody ProduitRequest r) { return catalogue.enregistrer(a.getName(), id, r); }
    @GetMapping("/adresses") @PreAuthorize("hasRole('CLIENT')")
    @Operation(summary = "Lister ses adresses", description = "Adresses du client connecté. Un compte peut enregistrer au maximum vingt adresses.")
    public List<AdresseVue> adresses(Authentication a) { return adresses.lister(a.getName()); }
    @PostMapping("/adresses") @ResponseStatus(HttpStatus.CREATED) @PreAuthorize("hasRole('CLIENT')")
    @Operation(summary = "Enregistrer une adresse", description = "Libellé de 1 à 80 caractères, adresse de 1 à 250 caractères et coordonnées WGS84 valides.")
    public AdresseVue creerAdresse(Authentication a, @RequestBody AdresseRequest r) { return adresses.enregistrer(a.getName(), null, r); }
    @PutMapping("/adresses/{id}") @PreAuthorize("hasRole('CLIENT')")
    @Operation(summary = "Modifier une adresse", description = "Réservé au propriétaire. Les coordonnées et l’adresse déjà copiées dans les commandes restent inchangées.")
    public AdresseVue modifierAdresse(Authentication a, @PathVariable Long id, @RequestBody AdresseRequest r) { return adresses.enregistrer(a.getName(), id, r); }
    @DeleteMapping("/adresses/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) @PreAuthorize("hasRole('CLIENT')")
    @Operation(summary = "Supprimer une adresse", description = "Réservé au propriétaire ; les anciennes commandes conservent leur adresse de livraison.")
    public void supprimerAdresse(Authentication a, @PathVariable Long id) { adresses.supprimer(a.getName(), id); }
    @GetMapping("/partenaires") @PreAuthorize("hasRole('CLIENT')")
    @Operation(summary = "Rechercher les commerces desservant une adresse", description = "adresseId obligatoire ; filtres facultatifs categorie et recherche. Retourne seulement les commerces actifs, ouverts et de la zone de l’adresse.")
    public List<CommerceVue> partenaires(Authentication a, @RequestParam Long adresseId, @RequestParam(required = false) String categorie, @RequestParam(required = false) String recherche) {
        return catalogue.rechercher(a.getName(), adresseId, categorie, recherche);
    }
    @GetMapping("/partenaires/{id}/produits") @PreAuthorize("hasRole('CLIENT')")
    @Operation(summary = "Consulter le catalogue d’un commerce", description = "adresseId obligatoire. Le commerce doit être ouvert et desservir cette adresse.")
    public List<ProduitVue> produits(Authentication a, @PathVariable Long id, @RequestParam Long adresseId) { return catalogue.catalogue(a.getName(), id, adresseId); }
    @PostMapping("/commandes/devis") @PreAuthorize("hasRole('CLIENT')")
    @Operation(summary = "Calculer un devis", description = "Le serveur calcule les prix, les frais de zone et la réduction du groupe de quartier disponible, le total et l’empreinte du devis. Un panier ne peut contenir qu’un seul partenaire.")
    public DevisVue devis(Authentication a, @RequestBody PanierRequest r) { return commandes.devis(a.getName(), r); }
    @PostMapping("/commandes") @ResponseStatus(HttpStatus.CREATED) @PreAuthorize("hasRole('CLIENT')")
    @Operation(summary = "Confirmer une commande COD ou carte", description = "Fournir devisEmpreinte et une cleIdempotence unique de 16 à 100 caractères. modePaiement vaut COD par défaut ; CARTE retourne une URL Stripe si configuré, avec capture au prix final après fermeture du groupe. Vérifie les prix et les limites ; le rejeu identique ne crée pas de doublon.")
    public LivraisonResponse commander(Authentication a, @RequestBody PanierRequest r) { return commandes.commander(a.getName(), r); }
    @PutMapping("/commandes/{id}/annuler") @PreAuthorize("hasRole('CLIENT')")
    @Operation(summary = "Annuler sa commande", description = "Annulation possible seulement en attente du partenaire ou après acceptation, avant le début de préparation. Motif facultatif de 300 caractères maximum.")
    public LivraisonResponse annuler(Authentication a, @PathVariable Long id, @RequestBody(required = false) AnnulationRequest r) {
        return commandes.annuler(a.getName(), id, r);
    }
    @GetMapping("/commandes/{id}/historique") @PreAuthorize("hasRole('CLIENT')")
    @Operation(summary = "Consulter les étapes de sa commande", description = "Historique chronologique des statuts et motifs. Une commande d’un autre client retourne 404.")
    public List<com.fleetpulse.livraison.Dto.CommandePartenaireDto.HistoriqueVue> historique(Authentication a, @PathVariable Long id) {
        return commandes.historique(a.getName(), id);
    }
    // US-302 / US-303 : position du coursier (colis a bord) et heure d'arrivee estimee
    @GetMapping("/commandes/{id}/suivi") @PreAuthorize("hasRole('CLIENT')")
    @Operation(summary = "Suivre sa livraison", description = "Statut, ETA et position du livreur ; la position du coursier n’est visible qu’après la collecte du colis.")
    public com.fleetpulse.livraison.Dto.SuiviDto.SuiviCommandeVue suivi(Authentication a, @PathVariable Long id) {
        return suivi.suivi(a.getName(), id);
    }
    // US-305 : QR dynamique a usage unique, a montrer au livreur
    @GetMapping("/commandes/{id}/qr-remise") @PreAuthorize("hasRole('CLIENT')")
    @Operation(summary = "Afficher son QR de remise", description = "Uniquement lorsque le colis est à bord. Le QR signé expire au bout de deux minutes ; chaque appel invalide le QR précédent. À montrer après paiement.")
    public com.fleetpulse.livraison.Dto.RemiseDto.QrRemiseVue qrRemise(Authentication a, @PathVariable Long id) {
        return remise.qr(a.getName(), id);
    }
    // US-310 : nouveau code de remise a 6 chiffres par SMS
    @PostMapping("/commandes/{id}/code-remise") @PreAuthorize("hasRole('CLIENT')")
    @Operation(summary = "Redemander un code de remise", description = "Code de secours à six chiffres ; au moins 60 secondes entre deux envois et quatre envois au total. Nécessite une passerelle SMS/email, ou le mode démonstration.")
    public com.fleetpulse.livraison.Dto.RemiseDto.CodeRemiseEnvoye codeRemise(Authentication a, @PathVariable Long id) {
        return remise.renvoyerCode(a.getName(), id);
    }
}
