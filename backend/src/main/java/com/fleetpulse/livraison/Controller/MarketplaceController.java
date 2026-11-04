package com.fleetpulse.livraison.Controller;

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
public class MarketplaceController {
    private final ZoneService zones;
    private final CatalogueService catalogue;
    private final AdresseService adresses;
    private final CommandeService commandes;
    @GetMapping("/admin/zones") @PreAuthorize("hasAnyRole('ADMIN','OPERATIONS')")
    public List<ZoneVue> zones() { return zones.lister(); }
    @PostMapping("/admin/zones") @ResponseStatus(HttpStatus.CREATED) @PreAuthorize("hasAnyRole('ADMIN','OPERATIONS')")
    public ZoneVue creerZone(@RequestBody ZoneRequest r) { return zones.enregistrer(null, r); }
    @PutMapping("/admin/zones/{id}") @PreAuthorize("hasAnyRole('ADMIN','OPERATIONS')")
    public ZoneVue modifierZone(@PathVariable Long id, @RequestBody ZoneRequest r) { return zones.enregistrer(id, r); }
    @DeleteMapping("/admin/zones/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) @PreAuthorize("hasAnyRole('ADMIN','OPERATIONS')")
    public void supprimerZone(@PathVariable Long id) { zones.supprimer(id); }
    @GetMapping("/partenaire/commerce") @PreAuthorize("hasRole('PARTENAIRE')")
    public CommerceVue moi(Authentication a) { return catalogue.moi(a.getName()); }
    @PutMapping("/partenaire/commerce") @PreAuthorize("hasRole('PARTENAIRE')")
    public CommerceVue ouverture(Authentication a, @RequestBody CommerceRequest r) { return catalogue.ouverture(a.getName(), r); }
    @GetMapping("/partenaire/produits") @PreAuthorize("hasRole('PARTENAIRE')")
    public List<ProduitVue> mesProduits(Authentication a) { return catalogue.mesProduits(a.getName()); }
    @PostMapping("/partenaire/produits") @ResponseStatus(HttpStatus.CREATED) @PreAuthorize("hasRole('PARTENAIRE')")
    public ProduitVue creerProduit(Authentication a, @RequestBody ProduitRequest r) { return catalogue.enregistrer(a.getName(), null, r); }
    @PutMapping("/partenaire/produits/{id}") @PreAuthorize("hasRole('PARTENAIRE')")
    public ProduitVue modifierProduit(Authentication a, @PathVariable Long id, @RequestBody ProduitRequest r) { return catalogue.enregistrer(a.getName(), id, r); }
    @GetMapping("/adresses") @PreAuthorize("hasRole('CLIENT')")
    public List<AdresseVue> adresses(Authentication a) { return adresses.lister(a.getName()); }
    @PostMapping("/adresses") @ResponseStatus(HttpStatus.CREATED) @PreAuthorize("hasRole('CLIENT')")
    public AdresseVue creerAdresse(Authentication a, @RequestBody AdresseRequest r) { return adresses.enregistrer(a.getName(), null, r); }
    @PutMapping("/adresses/{id}") @PreAuthorize("hasRole('CLIENT')")
    public AdresseVue modifierAdresse(Authentication a, @PathVariable Long id, @RequestBody AdresseRequest r) { return adresses.enregistrer(a.getName(), id, r); }
    @DeleteMapping("/adresses/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) @PreAuthorize("hasRole('CLIENT')")
    public void supprimerAdresse(Authentication a, @PathVariable Long id) { adresses.supprimer(a.getName(), id); }
    @GetMapping("/partenaires") @PreAuthorize("hasRole('CLIENT')")
    public List<CommerceVue> partenaires(Authentication a, @RequestParam Long adresseId, @RequestParam(required = false) String categorie, @RequestParam(required = false) String recherche) {
        return catalogue.rechercher(a.getName(), adresseId, categorie, recherche);
    }
    @GetMapping("/partenaires/{id}/produits") @PreAuthorize("hasRole('CLIENT')")
    public List<ProduitVue> produits(Authentication a, @PathVariable Long id, @RequestParam Long adresseId) { return catalogue.catalogue(a.getName(), id, adresseId); }
    @PostMapping("/commandes/devis") @PreAuthorize("hasRole('CLIENT')")
    public DevisVue devis(Authentication a, @RequestBody PanierRequest r) { return commandes.devis(a.getName(), r); }
    @PostMapping("/commandes") @ResponseStatus(HttpStatus.CREATED) @PreAuthorize("hasRole('CLIENT')")
    public LivraisonResponse commander(Authentication a, @RequestBody PanierRequest r) { return commandes.commander(a.getName(), r); }
    @PutMapping("/commandes/{id}/annuler") @PreAuthorize("hasRole('CLIENT')")
    public LivraisonResponse annuler(Authentication a, @PathVariable Long id, @RequestBody(required = false) AnnulationRequest r) {
        return commandes.annuler(a.getName(), id, r);
    }
    @GetMapping("/commandes/{id}/historique") @PreAuthorize("hasRole('CLIENT')")
    public List<com.fleetpulse.livraison.Dto.CommandePartenaireDto.HistoriqueVue> historique(Authentication a, @PathVariable Long id) {
        return commandes.historique(a.getName(), id);
    }
}
