package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.*;
import com.fleetpulse.livraison.Dto.MarketplaceDto.*;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.*;
import com.fleetpulse.livraison.Repository.*;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @RequiredArgsConstructor @Transactional
public class CommandeService {
    private final ClientRepository clients;
    private final PartenaireRepository partenaires;
    private final ProduitRepository produits;
    private final LivraisonRepository commandes;
    private final CatalogueService catalogue;
    private final ZoneService zones;
    private final CommandeWorkflow workflow;
    @Value("${app.commandes.minimum:1}") private BigDecimal minimum;
    @Value("${app.commandes.maximum:1000}") private BigDecimal maximum;
    @Value("${app.commandes.actives-max:3}") private int activesMax;
    @Value("${app.commandes.intervalle-secondes:30}") private int intervalle;
    private static final Set<StatutLivraison> ACTIVES = EnumSet.of(StatutLivraison.PENDING_PARTNER, StatutLivraison.ACCEPTEE,
            StatutLivraison.EN_PREPARATION, StatutLivraison.PRETE, StatutLivraison.AFFECTEE, StatutLivraison.RECUPEREE,
            StatutLivraison.EN_COURS, StatutLivraison.A_PROXIMITE, StatutLivraison.ARRIVEE);

    private void verifier(PanierRequest r) {
        if (r == null || r.partenaireId() == null || r.adresseId() == null || r.lignes() == null || r.lignes().isEmpty() || r.lignes().size() > 50)
            throw new IllegalArgumentException("Choisissez un partenaire, une adresse et de 1 à 50 produits.");
        if (r.notes() != null && r.notes().length() > 500) throw new IllegalArgumentException("Notes : 500 caractères maximum.");
        Set<Long> ids = new HashSet<>();
        for (Article a : r.lignes()) {
            if (a == null || a.produitId() == null || a.quantite() == null || a.quantite() < 1 || a.quantite() > 99 || !ids.add(a.produitId()))
                throw new IllegalArgumentException("Quantité de 1 à 99 ; chaque produit doit apparaître une seule fois.");
        }
    }
    public DevisVue devis(String email, PanierRequest r) {
        verifier(r);
        // Même ordre de verrouillage que la validation et les changements de catalogue.
        clients.verrouiller(email).orElseThrow(MarketplaceException::absent);
        return calculer(email, r);
    }
    private DevisVue calculer(String email, PanierRequest r) {
        AdresseLivraison adresse = catalogue.adresse(email, r.adresseId());
        Zone zone = zones.desservie(adresse.getLatitude(), adresse.getLongitude());
        Partenaire p = partenaires.verrouiller(r.partenaireId()).orElseThrow(MarketplaceException::absent);
        zones.rattacher(p);
        if (!p.isActif() || !Boolean.TRUE.equals(p.getOuvert())) throw MarketplaceException.conflit("Le partenaire est fermé ou indisponible.");
        if (p.getZone() == null || !p.getZone().getId().equals(zone.getId())) throw new IllegalArgumentException("Ce partenaire ne dessert pas cette adresse.");
        List<LigneVue> lignes = new ArrayList<>();
        for (Article a : r.lignes().stream().sorted(Comparator.comparing(Article::produitId)).toList()) {
            Produit produit = produits.findById(a.produitId()).orElseThrow(MarketplaceException::absent);
            if (!produit.getPartenaire().getId().equals(p.getId())) throw new IllegalArgumentException("Le panier doit contenir les produits d'un seul partenaire.");
            if (!produit.isDisponible()) throw MarketplaceException.conflit("Le produit « " + produit.getNom() + " » est indisponible.");
            BigDecimal prix = produit.getPrix();
            lignes.add(new LigneVue(produit.getId(), produit.getNom(), a.quantite(), prix, prix.multiply(BigDecimal.valueOf(a.quantite()))));
        }
        BigDecimal articles = lignes.stream().map(LigneVue::sousTotal).reduce(BigDecimal.ZERO, BigDecimal::add).setScale(3);
        BigDecimal total = articles.add(zone.getFraisLivraison()).setScale(3);
        if (articles.compareTo(minimum) < 0 || total.compareTo(maximum) > 0)
            throw new IllegalArgumentException("Montant invalide : articles minimum " + minimum + " DT, total maximum " + maximum + " DT.");
        String empreinte = hash(p.getId() + "|" + p.getNomCommerce() + "|" + zone.getId() + "|" + zone.getNom() + "|"
                + adresse.getAdresse() + "|" + adresse.getLatitude() + "|" + adresse.getLongitude() + "|" + lignes + "|" + total);
        return new DevisVue(p.getId(), p.getNomCommerce(), zone.getNom(), lignes, articles, zone.getFraisLivraison(), total, empreinte);
    }
    public LivraisonResponse commander(String email, PanierRequest r) {
        verifier(r);
        if (r.cleIdempotence() == null || !r.cleIdempotence().matches("[a-zA-Z0-9_-]{16,100}"))
            throw new IllegalArgumentException("Clé d'idempotence obligatoire (16 à 100 caractères).");
        if (r.devisEmpreinte() == null || !r.devisEmpreinte().matches("[a-f0-9]{64}"))
            throw new IllegalArgumentException("Vérifiez le devis avant de confirmer.");
        Client c = clients.verrouiller(email).orElseThrow(MarketplaceException::absent);
        String cle = c.getId() + ":" + r.cleIdempotence();
        String requete = hash(r.partenaireId() + "|" + r.adresseId() + "|" + r.lignes().stream().sorted(Comparator.comparing(Article::produitId)).toList()
                + "|" + (r.notes() == null ? "" : r.notes().trim()) + "|" + r.devisEmpreinte());
        Optional<Livraison> existante = commandes.findByCleIdempotence(cle);
        if (existante.isPresent()) {
            if (!requete.equals(existante.get().getEmpreinteRequete())) throw MarketplaceException.conflit("Cette clé a déjà servi pour un autre panier.");
            return LivraisonResponse.from(existante.get());
        }
        if (commandes.countByClientIdAndStatutIn(c.getId(), ACTIVES) >= activesMax)
            throw MarketplaceException.conflit("Nombre maximal de commandes actives atteint (" + activesMax + ").");
        commandes.findFirstByClientIdOrderByDateCreationDesc(c.getId()).ifPresent(derniere -> {
            if (derniere.getDateCreation().isAfter(Instant.now().minusSeconds(intervalle)))
                throw new MarketplaceException(429, "TROP_DE_DEMANDES", "Patientez " + intervalle + " secondes entre deux commandes.");
        });
        DevisVue d = calculer(email, r);
        if (!d.empreinte().equals(r.devisEmpreinte())) throw MarketplaceException.conflit("Le panier ou les frais ont changé. Vérifiez le nouveau devis.");
        AdresseLivraison a = catalogue.adresse(email, r.adresseId());
        Livraison l = new Livraison();
        c.passerCommande(l); l.setPartenaire(partenaires.getReferenceById(r.partenaireId())); l.setNomPartenaire(d.nomPartenaire()); l.setNomZone(d.zoneNom());
        l.setCodeSuivi("FP-" + UUID.randomUUID().toString().substring(0, 12).toUpperCase(Locale.ROOT));
        l.setAdresse(a.getAdresse()); l.setLatitude(a.getLatitude()); l.setLongitude(a.getLongitude());
        // Champs historiques conservés ; aucune promesse de délai ni décision partenaire au Sprint 2.
        l.setCreneauDebut(Instant.now()); l.setCreneauFin(l.getCreneauDebut()); l.setTypeLivraison(TypeLivraison.IMMEDIATE);
        l.setStatut(StatutLivraison.PENDING_PARTNER); l.setModePaiement(ModePaiement.COD); l.setStatutPaiement(StatutPaiement.A_LA_LIVRAISON);
        l.setNotes(r.notes() == null ? null : r.notes().trim()); l.setFraisLivraison(d.fraisLivraison().doubleValue());
        l.setCleIdempotence(cle); l.setEmpreinteRequete(requete);
        for (LigneVue article : d.lignes()) {
            LigneCommande ligne = new LigneCommande(); ligne.setCommande(l); ligne.setProduit(produits.getReferenceById(article.produitId()));
            ligne.setNomProduit(article.nomProduit()); ligne.setQuantite(article.quantite()); ligne.setPrixUnitaire(article.prixUnitaire()); ligne.setSousTotal(article.sousTotal()); l.getLignes().add(ligne);
        }
        l.calculerTotal(); l.setMontantACollecter(l.getTotal().doubleValue());
        Livraison creee = commandes.saveAndFlush(l);
        workflow.creer(creee, c);
        return LivraisonResponse.from(creee);
    }
    private static String hash(String s) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8))); }
        catch (java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
}
