package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.MarketplaceDto.*;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.StatutCompte;
import com.fleetpulse.livraison.Repository.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.access.AccessDeniedException;

@Service @RequiredArgsConstructor @Transactional
public class CatalogueService {
    private final PartenaireRepository partenaires;
    private final ProduitRepository produits;
    private final AdresseLivraisonRepository adresses;
    private final ZoneService zones;
    public Partenaire titulaire(String email) {
        Partenaire p = partenaires.verrouillerEmail(email).orElseThrow(MarketplaceException::absent);
        if (!p.isActif()) throw new AccessDeniedException("Partenaire non validé.");
        zones.rattacher(p);
        return p;
    }
    public CommerceVue moi(String email) { return CommerceVue.from(titulaire(email)); }
    public CommerceVue ouverture(String email, CommerceRequest r) {
        Partenaire p = titulaire(email);
        if (r == null || r.ouvert() == null) throw new IllegalArgumentException("Indiquez l'ouverture du commerce.");
        if (r.ouvert() && p.getZone() == null) throw MarketplaceException.conflit("Aucune zone ne couvre le commerce. Contactez le responsable.");
        p.setOuvert(r.ouvert()); return CommerceVue.from(p);
    }
    public List<ProduitVue> mesProduits(String email) { return produits.findAllByPartenaireIdOrderByIdAsc(titulaire(email).getId()).stream().map(ProduitVue::from).toList(); }
    public ProduitVue enregistrer(String email, Long id, ProduitRequest r) {
        Partenaire p = titulaire(email);
        if (r == null || r.nom() == null || r.nom().isBlank() || r.nom().trim().length() > 120 || r.disponible() == null)
            throw new IllegalArgumentException("Nom (120 caractères maximum) et disponibilité obligatoires.");
        Produit produit = id == null ? new Produit() : produits.findById(id).orElseThrow(MarketplaceException::absent);
        if (id != null && !produit.getPartenaire().getId().equals(p.getId())) throw new AccessDeniedException("Catalogue d'un autre partenaire.");
        produit.setPartenaire(p); produit.setNom(r.nom().trim()); produit.setPrix(ZoneService.argent(r.prix(), false)); produit.setDisponible(r.disponible());
        return ProduitVue.from(produits.save(produit));
    }
    @Transactional(readOnly = true)
    public List<CommerceVue> rechercher(String email, Long adresseId, String categorie, String recherche) {
        AdresseLivraison a = adresse(email, adresseId);
        Zone z = zones.desservie(a.getLatitude(), a.getLongitude());
        return partenaires.findAll().stream().filter(p -> p.getStatut() == StatutCompte.ACTIF && Boolean.TRUE.equals(p.getOuvert()))
                .filter(p -> p.getZone() != null && z.getId().equals(p.getZone().getId()))
                .filter(p -> categorie == null || categorie.isBlank() || categorie.equalsIgnoreCase(p.getCategorie()))
                .filter(p -> recherche == null || recherche.isBlank() || p.getNomCommerce().toLowerCase(Locale.ROOT).contains(recherche.trim().toLowerCase(Locale.ROOT)))
                .sorted(Comparator.comparing(Partenaire::getNomCommerce)).map(CommerceVue::from).toList();
    }
    @Transactional(readOnly = true)
    public List<ProduitVue> catalogue(String email, Long id, Long adresseId) {
        if (rechercher(email, adresseId, null, null).stream().noneMatch(p -> p.id().equals(id)))
            throw MarketplaceException.conflit("Ce partenaire est fermé ou ne dessert pas votre adresse.");
        return produits.findAllByPartenaireIdOrderByIdAsc(id).stream().map(ProduitVue::from).toList();
    }
    public AdresseLivraison adresse(String email, Long id) {
        if (id == null) throw new IllegalArgumentException("Choisissez une adresse.");
        AdresseLivraison a = adresses.findById(id).orElseThrow(MarketplaceException::absent);
        if (!a.getClient().getEmail().equals(email)) throw new AccessDeniedException("Adresse d'un autre client.");
        return a;
    }
}
