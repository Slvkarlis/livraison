package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Config.ModeDemonstration;
import com.fleetpulse.livraison.Dto.FinanceDto.*;
import com.fleetpulse.livraison.Dto.MarketplaceDto.Position;
import com.fleetpulse.livraison.Dto.NotationDto.Demande;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.*;
import com.fleetpulse.livraison.Repository.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Jeu synthétique uniquement sur une base de démonstration dédiée ; transaction et marqueur idempotent. */
@Component @RequiredArgsConstructor
public class Sprint6DemoInitializer {
    private final ModeDemonstration mode;
    private final UtilisateurRepository utilisateurs;
    private final ZoneRepository zones;
    private final ProduitRepository produits;
    private final LivraisonRepository commandes;
    private final AffectationZoneRepository affectations;
    private final PasswordEncoder encoder;
    private final ComptabiliteService comptabilite;
    private final CaisseService caisses;
    private final ClosingService closings;
    private final NotationService notations;
    @Value("${app.sprint6.donnees-demo:false}") private boolean donnees;
    @Value("${app.sprint6.mot-de-passe-demo:demo-sprint6-password}") private String motDePasse;

    @EventListener(ApplicationReadyEvent.class) @Order(100) @Transactional
    public void initialiser() {
        if (!donnees || !mode.estActif() || utilisateurs.existsByEmail("client@sprint6.demo")) return;
        Instant maintenant = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        List<Zone> secteurs = List.of(zone("Démo S6 · Tunis Ouest", 10.14), zone("Démo S6 · Tunis Est", 10.18));
        Client client = compte(new Client(), Role.CLIENT, "client@sprint6.demo", "Client démo");
        List<Partenaire> partenaires = new ArrayList<>(); List<Produit> articles = new ArrayList<>();
        for (int i = 0; i < 2; i++) {
            Partenaire p = compte(new Partenaire(), Role.PARTENAIRE, "partenaire" + (i + 1) + "@sprint6.demo", "Commerce " + (i + 1));
            p.setNomCommerce(i == 0 ? "La Table de Tunis · Démo" : "Le Marché du Lac · Démo"); p.setCategorie("Restaurant");
            p.setZone(secteurs.get(i)); p.setOuvert(true); p.setLatitude(36.80); p.setLongitude(10.16 + i * .04); p.setAdresse("Adresse synthétique, Tunis");
            Produit produit = new Produit(); produit.setPartenaire(p); produit.setNom(i == 0 ? "Menu maison démo" : "Panier démo");
            produit.setPrix(new BigDecimal("60.000")); articles.add(produits.save(produit)); partenaires.add(p);
        }
        List<Livreur> coursiers = new ArrayList<>();
        for (int i = 0; i < 3; i++) {
            Livreur l = compte(new Livreur(), Role.LIVREUR, "coursier" + (i + 1) + "@sprint6.demo", "Coursier " + (i + 1));
            l.setDisponible(i < 2); l.placer(36.80, 10.16 + (i % 2) * .04, maintenant); l.setDisponibiliteMiseAJourLe(maintenant);
            for (int z = 0; z < 2; z++) {
                AffectationZone a = new AffectationZone(); a.setLivreur(l); a.setZone(secteurs.get(z));
                a.setType(z == i % 2 ? TypeAffectation.PRINCIPALE : TypeAffectation.SECONDAIRE); affectations.save(a);
            }
            coursiers.add(l);
        }
        for (int i = 0; i < 30; i++) {
            int partenaire = i % 2; Livreur livreur = coursiers.get(i % 3);
            Instant livree = maintenant.minusSeconds(3600 + (i / 3) * 86400L + (i % 3) * 300L);
            Livraison c = commande(client, partenaires.get(partenaire), articles.get(partenaire), i, livree);
            c.setLivreur(livreur); c.setStatut(StatutLivraison.LIVREE); c.setLivreeLe(livree);
            c.setMontantEncaisse(c.getTotal()); c.setRecupereeLe(livree.minusSeconds(600 + (i % 5) * 60L));
            c.setPromesseLivraison(livree.plusSeconds(i % 4 == 0 ? -300 : 300));
            commandes.save(c); comptabilite.comptabiliser(c);
            if (i < 28) {
                notations.noter(client.getEmail(), c.getId(), new Demande(Role.PARTENAIRE, BigDecimal.valueOf(1 + i % 5), "Avis synthétique de démonstration"));
                notations.noter(client.getEmail(), c.getId(), new Demande(Role.LIVREUR, BigDecimal.valueOf(3 + i % 3), null));
                notations.noter(livreur.getEmail(), c.getId(), new Demande(Role.CLIENT, BigDecimal.valueOf(3 + i % 3), null));
                notations.noter(c.getPartenaire().getEmail(), c.getId(), new Demande(Role.LIVREUR, BigDecimal.valueOf(2 + i % 4), null));
            }
        }
        for (int i = 0; i < 5; i++) {
            Livraison refus = commande(client, partenaires.get(i % 2), articles.get(i % 2), 30 + i, maintenant.minusSeconds(7200 + i * 3600L));
            refus.setAccepteeLe(null); refus.setPreteLe(null); refus.setTempsPreparationMinutes(null);
            refus.setStatut(StatutLivraison.REFUSEE); refus.setMotifRefus(i % 2 == 0 ? MotifRefus.RUPTURE : MotifRefus.TROP_DE_COMMANDES); commandes.save(refus);
        }
        Livraison attente = commande(client, partenaires.get(0), articles.get(0), 35, maintenant.minusSeconds(3600));
        attente.setStatut(StatutLivraison.PRETE); attente.setPreteLe(maintenant.minusSeconds(1800));
        attente.setPromesseLivraison(maintenant.minusSeconds(900)); commandes.save(attente);
        // Le troisième coursier garde son cash ; les deux premiers le déposent avec un reçu réel.
        for (int i = 0; i < 2; i++) caisses.deposer("demo", new DepotRequest(coursiers.get(i).getId(), caisses.caisse(coursiers.get(i).getId()).solde(), null, "sprint6-demo-depot-" + i));
        closings.valider("demo", new ClosingRequest(LocalDate.now(ZoneId.of("Africa/Tunis")).minusWeeks(1)));
    }

    private Zone zone(String nom, double longitude) {
        Zone z = new Zone(); z.setNom(nom); z.setFraisLivraison(new BigDecimal("3.000"));
        z.definirPolygone(ZoneService.polygone(List.of(new Position(36.78, longitude), new Position(36.78, longitude + .04),
                new Position(36.82, longitude + .04), new Position(36.82, longitude))));
        return zones.save(z);
    }
    private <T extends Utilisateur> T compte(T u, Role role, String email, String prenom) {
        u.setRole(role); u.setEmail(email); u.setPrenom(prenom); u.setNom("Démo S6"); u.setMotDePasseHash(encoder.encode(motDePasse));
        return utilisateurs.save(u);
    }
    private Livraison commande(Client client, Partenaire p, Produit produit, int index, Instant fin) {
        Livraison c = new Livraison(); c.setCodeSuivi("DEMO-S6-" + (index + 1)); c.setClient(client); c.setPartenaire(p);
        c.setNomPartenaire(p.getNomCommerce()); c.setNomZone(p.getZone().getNom()); c.setAdresse("Adresse client synthétique");
        c.setLatitude(36.805); c.setLongitude(p.getLongitude() + .005); c.setCreneauDebut(fin.minusSeconds(3600)); c.setCreneauFin(fin.plusSeconds(3600));
        c.setDateCreation(fin.minusSeconds(2100)); c.setTempsPreparationMinutes(10 + index % 3);
        c.setAccepteeLe(fin.minusSeconds(1800)); c.setPreteLe(fin.minusSeconds(1080));
        LigneCommande ligne = new LigneCommande(); ligne.setCommande(c); ligne.setProduit(produit); ligne.setNomProduit(produit.getNom());
        ligne.setQuantite(1 + index % 3); ligne.setPrixUnitaire(produit.getPrix()); ligne.setSousTotal(produit.getPrix().multiply(BigDecimal.valueOf(ligne.getQuantite())));
        c.getLignes().add(ligne); c.setFraisLivraison(3); c.calculerTotal(); return c;
    }
}
