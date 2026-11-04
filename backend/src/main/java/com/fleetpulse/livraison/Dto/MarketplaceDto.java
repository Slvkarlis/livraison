package com.fleetpulse.livraison.Dto;

import com.fleetpulse.livraison.Model.*;
import java.math.BigDecimal;
import java.util.*;

/** Contrats explicites : aucune entité ni donnée d'identité privée n'est exposée. */
public final class MarketplaceDto {
    private MarketplaceDto() { }
    public record Position(Double latitude, Double longitude) { }
    public record ZoneRequest(String nom, List<Position> polygone, BigDecimal fraisLivraison) { }
    public record ZoneVue(Long id, String nom, List<Position> polygone, BigDecimal fraisLivraison, long partenaires) {
        public static ZoneVue from(Zone z, long n) {
            return new ZoneVue(z.getId(), z.getNom(), Arrays.stream(z.getPolygone().getCoordinates())
                    .map(c -> new Position(c.y, c.x)).toList(), z.getFraisLivraison(), n);
        }
    }
    public record ProduitRequest(String nom, BigDecimal prix, Boolean disponible) { }
    public record ProduitVue(Long id, Long partenaireId, String nom, BigDecimal prix, boolean disponible) {
        public static ProduitVue from(Produit p) { return new ProduitVue(p.getId(), p.getPartenaire().getId(), p.getNom(), p.getPrix(), p.isDisponible()); }
    }
    public record CommerceVue(Long id, String nomCommerce, String categorie, String adresse, boolean ouvert, Long zoneId, String zoneNom) {
        public static CommerceVue from(Partenaire p) {
            return new CommerceVue(p.getId(), p.getNomCommerce(), p.getCategorie(), p.getAdresse(), Boolean.TRUE.equals(p.getOuvert()),
                    p.getZone() == null ? null : p.getZone().getId(), p.getZone() == null ? null : p.getZone().getNom());
        }
    }
    public record CommerceRequest(Boolean ouvert) { }
    public record AdresseRequest(String libelle, String adresse, Double latitude, Double longitude) { }
    public record AdresseVue(Long id, String libelle, String adresse, double latitude, double longitude) {
        public static AdresseVue from(AdresseLivraison a) { return new AdresseVue(a.getId(), a.getLibelle(), a.getAdresse(), a.getLatitude(), a.getLongitude()); }
    }
    public record Article(Long produitId, Integer quantite) { }
    public record PanierRequest(Long partenaireId, Long adresseId, List<Article> lignes, String notes,
                                String cleIdempotence, String devisEmpreinte) { }
    public record LigneVue(Long produitId, String nomProduit, int quantite, BigDecimal prixUnitaire, BigDecimal sousTotal) {
        public static LigneVue from(LigneCommande l) { return new LigneVue(l.getProduit().getId(), l.getNomProduit(), l.getQuantite(), l.getPrixUnitaire(), l.getSousTotal()); }
    }
    /** US-2B12 : motif facultatif de l'annulation par le client. */
    public record AnnulationRequest(String motif) { }
    public record DevisVue(Long partenaireId, String nomPartenaire, String zoneNom, List<LigneVue> lignes,
                           BigDecimal montantArticles, BigDecimal fraisLivraison, BigDecimal total, String empreinte) { }
}
