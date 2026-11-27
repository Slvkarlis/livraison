package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.*;
import com.fleetpulse.livraison.Repository.*;
import com.fleetpulse.livraison.Service.EstimationArrivee.Point;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class QuartierServiceTest {
    final Instant maintenant = Instant.parse("2026-11-27T10:00:00Z");
    final QuartierService service = new QuartierService();
    final GroupeQuartierRepository groupes = mock(GroupeQuartierRepository.class);
    final LivraisonRepository commandes = mock(LivraisonRepository.class);
    final LotRepository lots = mock(LotRepository.class);
    final Partenaire p = new Partenaire(); final Zone z = new Zone();
    @BeforeEach void preparer() {
        z.setId(1L); p.setId(1L); p.setZone(z); p.setLatitude(36.80); p.setLongitude(10.18); p.setGroupesQuartierActifs(true);
        ReflectionTestUtils.setField(service, "groupes", groupes); ReflectionTestUtils.setField(service, "commandes", commandes);
        ReflectionTestUtils.setField(service, "lots", lots); ReflectionTestUtils.setField(service, "parametres", new ParametresQuartier());
        ReflectionTestUtils.setField(service, "dispatch", new ParametresDispatch(true, 60, 10, 35, 1.5, 30, false, 15000));
        ReflectionTestUtils.setField(service, "evenements", mock(ApplicationEventPublisher.class));
        when(groupes.save(any())).thenAnswer(a -> { GroupeQuartier g = a.getArgument(0); g.setId(1L); return g; });
        when(commandes.verrouiller(any())).thenAnswer(a -> Optional.of(commande(a.getArgument(0))));
    }
    Livraison commande(long id) {
        Livraison c = new Livraison(); c.setId(id); c.setPartenaire(p); c.setLatitude(36.82 + id * .0001); c.setLongitude(10.18);
        c.setDateCreation(maintenant); c.setMontantArticles(new BigDecimal("10.000")); c.setFraisLivraison(3);
        c.setFraisNormauxQuartier(new BigDecimal("3.000")); c.setFraisAnnoncesQuartier(new BigDecimal("3.000"));
        c.setPromesseLivraison(maintenant.plusSeconds(3600)); c.setStatut(StatutLivraison.PRETE); return c;
    }
    GroupeQuartier groupe() {
        GroupeQuartier g = new GroupeQuartier(); g.setId(1L); g.setCommerce(p); g.setZone(z); g.setLatitude(36.82); g.setLongitude(10.18);
        g.setRayonMetres(400); g.setOuverture(maintenant); g.setExpiration(maintenant.plusSeconds(480));
        g.setReductionDeux(new BigDecimal("0.40")); g.setReductionTrois(new BigDecimal("0.50")); return g;
    }
    @Test void ouvreSeulementSiCommerceActifEtTempsSuffisant() {
        Livraison c = commande(1);
        service.inscrire(c, null, new BigDecimal("3.000"), new BigDecimal("3.000"), maintenant);
        assertNotNull(c.getGroupeQuartier()); assertEquals(400, c.getGroupeQuartier().getRayonMetres());
        assertEquals(maintenant.plusSeconds(480), c.getGroupeQuartier().getExpiration());
        Livraison presse = commande(2); presse.setPromesseLivraison(maintenant.plusSeconds(600));
        service.inscrire(presse, null, new BigDecimal("3.000"), new BigDecimal("3.000"), maintenant); assertNull(presse.getGroupeQuartier());
        p.setGroupesQuartierActifs(false); Livraison inactif = commande(3);
        service.inscrire(inactif, null, new BigDecimal("3.000"), new BigDecimal("3.000"), maintenant); assertNull(inactif.getGroupeQuartier());
    }
    @Test void adhesionVerifieRayonZoneCommerceExpirationEtCapacite() {
        GroupeQuartier g = groupe();
        assertTrue(QuartierService.compatible(g, 1L, 1L, 36.821, 10.18, maintenant));
        assertFalse(QuartierService.compatible(g, 2L, 1L, 36.821, 10.18, maintenant));
        assertFalse(QuartierService.compatible(g, 1L, 2L, 36.821, 10.18, maintenant));
        assertFalse(QuartierService.compatible(g, 1L, 1L, 36.83, 10.18, maintenant));
        assertFalse(QuartierService.compatible(g, 1L, 1L, 36.821, 10.18, g.getExpiration()));
        g.getCommandes().addAll(List.of(commande(1), commande(2), commande(3)));
        assertFalse(QuartierService.compatible(g, 1L, 1L, 36.821, 10.18, maintenant));
        g.getCommandes().clear(); g.setStatut(StatutGroupeQuartier.COMPLET);
        assertFalse(QuartierService.compatible(g, 1L, 1L, 36.821, 10.18, maintenant));
    }
    @Test void prixUnDeuxTroisEtPlafondAnnonce() {
        GroupeQuartier g = groupe(); g.getCommandes().add(commande(1)); service.recalculer(g);
        assertEquals(new BigDecimal("3.000"), g.getCommandes().getFirst().getFraisFinauxQuartier());
        g.getCommandes().add(commande(2)); service.recalculer(g);
        g.getCommandes().forEach(c -> assertEquals(new BigDecimal("1.800"), c.getFraisFinauxQuartier()));
        g.getCommandes().add(commande(3)); service.recalculer(g);
        assertEquals(new BigDecimal("1.500"), g.getCommandes().getFirst().getFraisFinauxQuartier());
        assertEquals(new BigDecimal("0.000"), g.getCommandes().getLast().getFraisFinauxQuartier());
        g.getCommandes().removeFirst(); service.recalculer(g);
        assertEquals(new BigDecimal("1.500"), g.getCommandes().getFirst().getFraisFinauxQuartier());
        assertEquals(new BigDecimal("0.000"), g.getCommandes().getLast().getFraisFinauxQuartier());
    }
    @Test void annulationRetireLeMembreSansAugmenterLePrix() {
        GroupeQuartier g = groupe(); Livraison a = commande(1), b = commande(2);
        g.getCommandes().addAll(List.of(a, b)); a.setGroupeQuartier(g); b.setGroupeQuartier(g); service.recalculer(g);
        when(commandes.findById(1L)).thenReturn(Optional.of(a)); when(groupes.verrouiller(1L)).thenReturn(Optional.of(g));
        service.surStatut(new CommandeStatutChange(1L, 1L, null, 1L, null, null, StatutLivraison.ACCEPTEE, StatutLivraison.ANNULEE, Role.CLIENT));
        assertNull(a.getGroupeQuartier()); assertEquals(List.of(b), g.getCommandes()); assertEquals(new BigDecimal("1.800"), b.getFraisFinauxQuartier());
    }
    @Test void fermetureCreeUnSeulLotImposeEtEnregistreLeGain() {
        GroupeQuartier g = groupe(); g.getCommandes().addAll(List.of(commande(1), commande(2), commande(3)));
        service.fermer(g, maintenant.plusSeconds(40));
        assertEquals(StatutGroupeQuartier.FERME, g.getStatut()); verify(lots, times(1)).save(any());
        assertEquals("QUARTIER", g.getLot().getSource()); assertTrue(g.getGainKm() > 0); assertTrue(g.getGainDt().signum() > 0);
        g.getCommandes().forEach(c -> { assertSame(g.getLot(), c.getLot()); assertEquals(2, c.getVoisinsQuartier()); });
    }
    @Test void singletonExpireSansLotNiSurcout() {
        GroupeQuartier g = groupe(); Livraison c = commande(1); g.getCommandes().add(c);
        service.fermer(g, g.getExpiration()); assertTrue(c.isQuartierSeule()); verifyNoInteractions(lots);
        assertEquals(new BigDecimal("3.000"), c.getFraisFinauxQuartier());
    }
    @Test void promesseImpossibleExclutLaCommandeEtConserveSonPrix() {
        GroupeQuartier g = groupe(); Livraison presse = commande(1), b = commande(2), c = commande(3);
        presse.setPromesseLivraison(maintenant.plusSeconds(5));
        g.getCommandes().addAll(List.of(presse, b, c)); service.recalculer(g);
        service.fermer(g, maintenant); assertNull(presse.getGroupeQuartier()); assertTrue(presse.isQuartierSeule());
        assertEquals(new BigDecimal("1.500"), presse.getFraisFinauxQuartier()); assertEquals(2, g.getCommandes().size());
    }
    @Test void itineraireRespecteToutesLesPromessesEtCompteLaRemise() {
        Point commerce = new Point(36.80, 10.18), client = new Point(36.82, 10.18);
        var courses = List.of(new Itineraire.Course(1L, commerce, client));
        assertTrue(Itineraire.optimiser(null, courses, 20, null, maintenant, Map.of(1L, maintenant.plusSeconds(30))).isEmpty());
        assertTrue(Itineraire.optimiser(null, courses, 20, null, maintenant, Map.of(1L, maintenant.plusSeconds(3600))).isPresent());
    }
    @Test void confidentialiteDtoEtTexteInvitation() {
        GroupeQuartier g = groupe(); Livraison c = commande(1); c.setAdresse("ADRESSE_SECRETE"); Client voisin = new Client();
        voisin.setNom("NOM_SECRET"); voisin.setEmail("EMAIL_SECRET"); c.setClient(voisin); g.getCommandes().add(c); p.setNomCommerce("Commerce public");
        String texte = InvitationsQuartierService.texte(g);
        assertFalse(texte.contains("SECRET")); assertTrue(texte.contains("1 voisin")); assertTrue(texte.contains("-40 %"));
        Set<String> champs = new HashSet<>();
        for (var r : com.fleetpulse.livraison.Dto.QuartierDto.GroupeProche.class.getRecordComponents()) champs.add(r.getName());
        assertFalse(champs.contains("latitude")); assertFalse(champs.contains("commandes")); assertFalse(champs.contains("client"));
    }
}
