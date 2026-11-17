package com.fleetpulse.livraison.Dto;

import com.fleetpulse.livraison.Model.*;
import java.math.BigDecimal;
import java.util.*;
import io.swagger.v3.oas.annotations.media.Schema;

/** Contrats explicites : aucune entité ni donnée d'identité privée n'est exposée. */
public final class MarketplaceDto {
    private MarketplaceDto() { }
    @Schema(description = "Coordonnées géographiques WGS84, latitude puis longitude.")
    public record Position(@Schema(example = "36.8065", minimum = "-90", maximum = "90") Double latitude,
                           @Schema(example = "10.1815", minimum = "-180", maximum = "180") Double longitude) { }
    /** vitesseMoyenneKmh (US-303) : facultative, la valeur actuelle (ou 20 km/h) est gardee si absente. */
    @Schema(description = "Contour de 3 à 200 sommets sans chevauchement ; frontières communes autorisées.")
    public record ZoneRequest(@Schema(example = "Tunis centre") String nom, List<Position> polygone,
                              @Schema(description = "Frais en DT, de 0 à 100000, trois décimales maximum", example = "3.500") BigDecimal fraisLivraison,
                              @Schema(description = "Facultative : 20 par défaut ; valeur précédente conservée en modification", example = "20", minimum = "5", maximum = "80") Double vitesseMoyenneKmh) { }
    @Schema(description = "Zone partageant un segment de frontière avec la zone consultée ; un contact par un sommet seul ne suffit pas.")
    public record ZoneVoisine(Long id, String nom) { }
    public record ZoneVue(Long id, String nom, List<Position> polygone, BigDecimal fraisLivraison, long partenaires,
                          double vitesseMoyenneKmh, List<ZoneVoisine> voisines) {
        public static ZoneVue from(Zone z, long n) {
            return from(z, n, List.of());
        }
        public static ZoneVue from(Zone z, long n, List<ZoneVoisine> voisines) {
            return new ZoneVue(z.getId(), z.getNom(), Arrays.stream(z.getPolygone().getCoordinates())
                    .map(c -> new Position(c.y, c.x)).toList(), z.getFraisLivraison(), n, z.vitesseMoyenne(), voisines);
        }
    }
    @Schema(description = "Produit du partenaire connecté ; prix strictement positif, trois décimales maximum.")
    public record ProduitRequest(@Schema(example = "Couscous") String nom, @Schema(example = "8.000") BigDecimal prix,
                                 @Schema(example = "true") Boolean disponible) { }
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
    @Schema(description = "Adresse personnelle du client ; au maximum vingt adresses par compte.")
    public record AdresseRequest(@Schema(example = "Maison") String libelle,
                                 @Schema(example = "12 rue de Tunis") String adresse,
                                 @Schema(example = "36.8065") Double latitude, @Schema(example = "10.1815") Double longitude) { }
    public record AdresseVue(Long id, String libelle, String adresse, double latitude, double longitude) {
        public static AdresseVue from(AdresseLivraison a) { return new AdresseVue(a.getId(), a.getLibelle(), a.getAdresse(), a.getLatitude(), a.getLongitude()); }
    }
    public record Article(@Schema(example = "6") Long produitId,
                          @Schema(example = "2", minimum = "1", maximum = "99") Integer quantite) { }
    @Schema(description = "Panier d’un seul commerce. Devis : IDs et lignes suffisent. Confirmation : ajouter la clé et l’empreinte du devis reçu.")
    public record PanierRequest(Long partenaireId, Long adresseId, List<Article> lignes, String notes,
                                @Schema(description = "Unique pour cette confirmation ; réutiliser la même clé uniquement pour rejouer la même requête", example = "commande-demo-000001", minLength = 16, maxLength = 100) String cleIdempotence,
                                @Schema(description = "Copier exactement empreinte depuis la réponse de /api/commandes/devis", minLength = 64, maxLength = 64) String devisEmpreinte) { }
    public record LigneVue(Long produitId, String nomProduit, int quantite, BigDecimal prixUnitaire, BigDecimal sousTotal) {
        public static LigneVue from(LigneCommande l) { return new LigneVue(l.getProduit().getId(), l.getNomProduit(), l.getQuantite(), l.getPrixUnitaire(), l.getSousTotal()); }
    }
    /** US-2B12 : motif facultatif de l'annulation par le client. */
    public record AnnulationRequest(String motif) { }
    public record DevisVue(Long partenaireId, String nomPartenaire, String zoneNom, List<LigneVue> lignes,
                           BigDecimal montantArticles, BigDecimal fraisLivraison, BigDecimal total, String empreinte) { }
}
