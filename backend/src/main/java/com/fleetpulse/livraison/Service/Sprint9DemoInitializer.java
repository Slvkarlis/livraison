package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Config.ModeDemonstration;
import com.fleetpulse.livraison.Dto.MarketplaceDto.*;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.*;
import com.fleetpulse.livraison.Repository.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import org.springframework.beans.factory.annotation.*;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Comptes synthétiques idempotents ; aucun groupe ni commande réels ne sont modifiés. */
@Component
public class Sprint9DemoInitializer {
    @Autowired private ModeDemonstration mode;
    @Autowired private UtilisateurRepository utilisateurs;
    @Autowired private AdresseLivraisonRepository adresses;
    @Autowired private ProduitRepository produits;
    @Autowired private ZoneService zones;
    @Autowired private AffectationZoneRepository affectations;
    @Autowired private PasswordEncoder encoder;
    @Value("${app.sprint9.donnees-demo:false}") private boolean donnees;
    @Value("${app.sprint9.mot-de-passe-demo:demo-sprint9-password}") private String motDePasse;

    @EventListener(ApplicationReadyEvent.class) @Order(110) @Transactional
    public void initialiser() {
        if (!donnees || !mode.estActif() || utilisateurs.existsByEmail("commerce@sprint9.demo")) return;
        Zone zone = zones.trouver(36.80, 10.18).orElseGet(() -> {
            Long id = zones.enregistrer(null, new ZoneRequest("Quartier démo S9", List.of(new Position(36.79, 10.17),
                    new Position(36.79, 10.20), new Position(36.84, 10.20), new Position(36.84, 10.17)), new BigDecimal("3.000"), 20.0)).id();
            return zones.trouver(36.80, 10.18).filter(z -> z.getId().equals(id)).orElseThrow();
        });
        Partenaire p = compte(new Partenaire(), "commerce@sprint9.demo", "Commerce", Role.PARTENAIRE);
        p.setNomCommerce("La Table du quartier · Démo"); p.setCategorie("Restaurant"); p.setAdresse("Commerce synthétique S9");
        p.setLatitude(36.80); p.setLongitude(10.18); p.setZone(zone); p.setOuvert(true); p.setGroupesQuartierActifs(true);
        Produit produit = new Produit(); produit.setPartenaire(p); produit.setNom("Menu quartier démo"); produit.setPrix(new BigDecimal("10.000")); produits.save(produit);
        for (int i = 1; i <= 3; i++) {
            Client c = compte(new Client(), "voisin" + i + "@sprint9.demo", "Voisin " + i, Role.CLIENT);
            AdresseLivraison a = new AdresseLivraison(); a.setClient(c); a.setLibelle("Maison démo"); a.setAdresse("Adresse synthétique S9 " + i);
            a.setLatitude(36.802 + i * .0002); a.setLongitude(10.18); adresses.save(a);
        }
        Livreur l = compte(new Livreur(), "coursier@sprint9.demo", "Coursier quartier", Role.LIVREUR);
        l.setDisponible(true); l.placer(36.80, 10.18, Instant.now()); l.setDisponibiliteMiseAJourLe(Instant.now());
        AffectationZone a = new AffectationZone(); a.setLivreur(l); a.setZone(zone); a.setType(TypeAffectation.PRINCIPALE); affectations.save(a);
    }

    private <T extends Utilisateur> T compte(T u, String email, String prenom, Role role) {
        u.setEmail(email); u.setNom("Démo quartier"); u.setPrenom(prenom); u.setRole(role); u.setMotDePasseHash(encoder.encode(motDePasse));
        return utilisateurs.save(u);
    }
}
