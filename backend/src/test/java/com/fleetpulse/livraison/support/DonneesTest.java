package com.fleetpulse.livraison.support;

import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.*;
import com.fleetpulse.livraison.Service.ZoneService;
import com.fleetpulse.livraison.Dto.MarketplaceDto.Position;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** Objets métier réels ; seuls les collaborateurs des classes testées sont simulés. */
public final class DonneesTest {
    private DonneesTest() { }

    public static Client client() {
        Client c = new Client(); c.setId(1L); c.setEmail("client@test.tn");
        c.setNom("Client"); c.setPrenom("Amal"); c.setRole(Role.CLIENT); c.setStatut(StatutCompte.ACTIF);
        c.setTelephone("+21620123456"); return c;
    }

    public static Zone zone() {
        Zone z = new Zone(); z.setId(2L); z.setNom("Tunis"); z.setFraisLivraison(new BigDecimal("3.500"));
        z.setVitesseMoyenneKmh(20.);
        z.definirPolygone(ZoneService.polygone(List.of(new Position(36., 10.), new Position(36., 11.),
                new Position(37., 11.), new Position(37., 10.))));
        return z;
    }

    public static Partenaire partenaire() {
        Partenaire p = new Partenaire(); p.setId(3L); p.setEmail("partenaire@test.tn"); p.setNom("Commerce");
        p.setPrenom("Amira"); p.setRole(Role.PARTENAIRE); p.setStatut(StatutCompte.ACTIF);
        p.setNomCommerce("Chez Amira"); p.setCategorie("Restaurant"); p.setAdresse("Tunis centre");
        p.setLatitude(36.8); p.setLongitude(10.18); p.setZone(zone()); p.setOuvert(true); return p;
    }

    public static Livreur livreur() {
        Livreur l = new Livreur(); l.setId(4L); l.setEmail("livreur@test.tn"); l.setNom("Livreur");
        l.setPrenom("Sami"); l.setRole(Role.LIVREUR); l.setStatut(StatutCompte.ACTIF);
        l.setDisponible(true); l.placer(36.8, 10.18, Instant.now()); return l;
    }

    public static Vehicule vehicule() {
        Vehicule v = new Vehicule(); v.setId(5L); v.setImmatriculation("123 TU 456");
        v.setType("Scooter"); v.setCapaciteKg(30.); v.setConsommationLitres100Km(3.); v.setActif(true); return v;
    }

    public static Produit produit() {
        Produit p = new Produit(); p.setId(6L); p.setPartenaire(partenaire()); p.setNom("Couscous");
        p.setPrix(new BigDecimal("8.000")); p.setDisponible(true); return p;
    }

    public static AdresseLivraison adresse() {
        AdresseLivraison a = new AdresseLivraison(); a.setId(7L); a.setClient(client()); a.setLibelle("Maison");
        a.setAdresse("Rue de Tunis"); a.setLatitude(36.81); a.setLongitude(10.19); return a;
    }

    public static Livraison commande(StatutLivraison statut) {
        Livraison c = new Livraison(); c.setId(8L); c.setClient(client()); c.setPartenaire(partenaire());
        c.setNomPartenaire("Chez Amira"); c.setNomZone("Tunis"); c.setLivreur(livreur());
        c.setCodeSuivi("FP-TEST-0001"); c.setCodeCollecte("K7Q2MX"); c.setAdresse("Rue de Tunis");
        c.setLatitude(36.81); c.setLongitude(10.19); c.setCreneauDebut(Instant.now()); c.setCreneauFin(Instant.now());
        c.setStatut(statut); c.setFraisLivraison(3.5); c.setMontantArticles(new BigDecimal("8.000"));
        c.setTotal(new BigDecimal("11.500")); c.setMontantACollecter(11.5); c.setPreteLe(Instant.now());
        c.setAffecteeLe(Instant.now()); c.setAccepteeLe(Instant.now()); c.setTempsPreparationMinutes(10); return c;
    }
}
