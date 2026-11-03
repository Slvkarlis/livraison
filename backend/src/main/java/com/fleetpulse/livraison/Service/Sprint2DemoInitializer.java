package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Config.ModeDemonstration;
import com.fleetpulse.livraison.Dto.MarketplaceDto.*;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.Role;
import com.fleetpulse.livraison.Repository.*;
import java.math.BigDecimal;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component @RequiredArgsConstructor
public class Sprint2DemoInitializer implements CommandLineRunner {
    private final ModeDemonstration mode;
    private final UtilisateurRepository utilisateurs;
    private final ZoneRepository zones;
    private final ZoneService zoneService;
    private final PartenaireRepository partenaires;
    private final ProduitRepository produits;
    private final PasswordEncoder encoder;
    @Value("${app.sprint2.donnees-demo:false}") private boolean donnees;
    @Transactional
    public void run(String... args) {
        if (!donnees || !mode.estActif()) return;
        // Une base déjà couverte conserve ses zones ; pas de remplacement ni réinitialisation de compte.
        if (zones.count() == 0) zoneService.enregistrer(null, new ZoneRequest("Tunis centre démo", List.of(
                new Position(36.77, 10.13), new Position(36.77, 10.23), new Position(36.85, 10.23), new Position(36.85, 10.13)), new BigDecimal("3.500")));
        creerPartenaire("restaurant@sprint2.demo", "Chez Amira", "Restaurant", 36.805, 10.18,
                List.of("Couscous", "Salade tunisienne", "Brik", "Sandwich", "Citronnade"));
        creerPartenaire("epicerie@sprint2.demo", "Épicerie du centre", "Épicerie", 36.81, 10.19,
                List.of("Pain", "Lait", "Œufs", "Eau minérale", "Dattes"));
        if (!utilisateurs.existsByEmail("client@sprint2.demo")) {
            Client c = new Client(); identite(c, "client@sprint2.demo", "Client démo", Role.CLIENT); utilisateurs.save(c);
        }
    }
    private void creerPartenaire(String email, String commerce, String categorie, double lat, double lng, List<String> noms) {
        if (utilisateurs.existsByEmail(email)) return;
        Partenaire p = new Partenaire(); identite(p, email, commerce, Role.PARTENAIRE);
        p.setNomCommerce(commerce); p.setCategorie(categorie); p.setAdresse("Tunis centre"); p.setLatitude(lat); p.setLongitude(lng); p.setMatriculeFiscal("DEMO");
        zoneService.rattacher(p); p.setOuvert(p.getZone() != null); partenaires.save(p);
        for (int i = 0; i < noms.size(); i++) {
            Produit produit = new Produit(); produit.setPartenaire(p); produit.setNom(noms.get(i)); produit.setPrix(BigDecimal.valueOf(2L + i * 2L).setScale(3)); produits.save(produit);
        }
    }
    private void identite(Utilisateur u, String email, String nom, Role role) {
        u.setEmail(email); u.setNom(nom); u.setPrenom("Démo"); u.setRole(role); u.setMotDePasseHash(encoder.encode("sprint2-demo-password"));
    }
}
