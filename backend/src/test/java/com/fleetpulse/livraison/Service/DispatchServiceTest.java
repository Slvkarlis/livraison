package com.fleetpulse.livraison.Service;

import static com.fleetpulse.livraison.support.DonneesTest.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.fleetpulse.livraison.Dto.DispatchDto.*;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.*;
import com.fleetpulse.livraison.Repository.*;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

/** US-402 a US-407 : dispatch par lots, collaborateurs simules (depots, workflow, entrepot, IA). */
@ExtendWith(MockitoExtension.class)
class DispatchServiceTest {
    @Mock AffectationMissionService affectationSimple; @Mock LivraisonRepository commandes; @Mock LotRepository lots;
    @Mock OffreLotRepository offres; @Mock AffectationZoneRepository affectations; @Mock ZoneRepository zones;
    @Mock LivreurRepository livreurs; @Mock UtilisateurRepository utilisateurs; @Mock CommandeWorkflow workflow;
    @Mock EntrepotService entrepot; @Mock AuditService audit; @Mock ServiceIa ia; @Mock ApplicationEventPublisher evenements;
    DispatchService service;
    Livraison commande;
    Livreur sami;

    DispatchService service(boolean parLots) {
        return new DispatchService(new ParametresDispatch(parLots, 60, 10, 35, 1.5, 0, false, 15000), affectationSimple, commandes, lots,
                offres, affectations, zones, livreurs, utilisateurs, workflow, entrepot, audit, ia, evenements);
    }

    @BeforeEach void preparer() {
        service = service(true);
        commande = commande(StatutLivraison.PRETE);
        commande.setLivreur(null);
        commande.setPreteLe(Instant.now().minusSeconds(60));
        sami = livreur();
    }

    AffectationZone affectation(Livreur l, TypeAffectation type) {
        AffectationZone a = new AffectationZone(); a.setLivreur(l); a.setZone(zone()); a.setType(type); return a;
    }

    Lot lot(StatutLot statut) {
        Lot lot = new Lot(); lot.setId(50L); lot.setStatut(statut); lot.setItineraire("C:8;L:8"); lot.setSource("REGLES");
        commande.setLot(lot); return lot;
    }

    OffreLot offre(Lot lot, Livreur l, Instant expireLe) {
        OffreLot o = new OffreLot(lot, l, Instant.now().minusSeconds(10), expireLe, false, 0.2, 0.2); o.setId(70L); return o;
    }

    @Test void modeSimpleDuSprint2bisConserve() {
        DispatchService simple = service(false);
        simple.commandePrete(commande);
        simple.livreurDisponible(sami, List.of(2L));
        simple.livreurIndisponible(sami);
        verify(affectationSimple).affecterSiPossible(commande);
        verify(affectationSimple).affecterCommandesEnAttente(sami, List.of(2L));
        verifyNoInteractions(lots, offres, workflow);
    }

    @Test void commandePreteFormeUnLotEtLeProposeAuCoursierDeLaZone() {
        when(commandes.findAllByStatutAndLivreurIsNullOrderByPreteLeAscIdAsc(StatutLivraison.PRETE)).thenReturn(List.of(commande));
        when(zones.findAllByOrderByIdAsc()).thenReturn(List.of(zone()));
        when(lots.save(any())).thenAnswer(i -> { Lot l = i.getArgument(0); l.setId(50L); return l; });
        when(commandes.verrouiller(8L)).thenReturn(Optional.of(commande));
        when(affectations.findAllByZoneId(2L)).thenReturn(List.of(affectation(sami, TypeAffectation.PRINCIPALE)));
        when(offres.save(any())).thenAnswer(i -> { OffreLot o = i.getArgument(0); o.setId(70L); return o; });

        service.commandePrete(commande);

        assertEquals(50L, commande.getLot().getId());
        assertEquals("C:8;L:8", commande.getLot().getItineraire());
        assertEquals("REGLES", commande.getLot().getSource());
        ArgumentCaptor<OffreLot> offre = ArgumentCaptor.forClass(OffreLot.class);
        verify(offres).save(offre.capture());
        assertEquals(sami, offre.getValue().getLivreur());
        assertEquals(StatutOffre.EN_ATTENTE, offre.getValue().getStatut());
        assertEquals(60, offre.getValue().getExpireLe().getEpochSecond() - offre.getValue().getProposeeLe().getEpochSecond());
        assertFalse(offre.getValue().isHorsZone());
        verify(evenements).publishEvent(new DispatchService.OffreProposee(sami.getEmail(), 70L, 8L));
        verify(entrepot).enregistrer(eq(TypeEvenement.OFFRE), eq(8L), eq(4L), eq(2L), eq(50L), anyDouble(), eq("PROPOSEE"), anyString());
        // Le coursier choisit : aucune affectation avant son acceptation
        verifyNoInteractions(workflow);
        assertNull(commande.getLivreur());
    }

    @Test void sansCoursierLaCommandeResteLibrePourUnFuturRegroupement() {
        when(commandes.findAllByStatutAndLivreurIsNullOrderByPreteLeAscIdAsc(StatutLivraison.PRETE)).thenReturn(List.of(commande));
        Livreur indisponible = livreur(); indisponible.setDisponible(false);
        when(affectations.findAllByZoneId(2L)).thenReturn(List.of(affectation(indisponible, TypeAffectation.PRINCIPALE)));

        service.commandePrete(commande);

        // Aucun lot fige : la commande pourra rejoindre une voisine prete plus tard
        assertNull(commande.getLot());
        verify(lots, never()).save(any());
        verify(offres, never()).save(any());
        verifyNoInteractions(evenements);
    }

    @Test void acceptationAffecteLesCommandesDuLotEtRejeuSansEffet() {
        Lot lot = lot(StatutLot.PROPOSE);
        OffreLot offre = offre(lot, sami, Instant.now().plusSeconds(50));
        when(livreurs.findByEmail(sami.getEmail())).thenReturn(Optional.of(sami));
        when(offres.verrouiller(70L)).thenReturn(Optional.of(offre));
        when(lots.verrouiller(50L)).thenReturn(Optional.of(lot));
        when(commandes.findAllByLotIdOrderByIdAsc(50L)).thenReturn(List.of(commande));
        when(commandes.verrouiller(8L)).thenReturn(Optional.of(commande));

        LotVue vue = service.accepter(sami.getEmail(), 70L);

        assertEquals(StatutOffre.ACCEPTEE, offre.getStatut());
        assertEquals(StatutLot.ACCEPTE, lot.getStatut());
        assertSame(sami, lot.getLivreur());
        assertSame(sami, commande.getLivreur());
        assertNotNull(commande.getAffecteeLe());
        verify(workflow).transition(eq(commande), eq(StatutLivraison.AFFECTEE), eq(sami), contains("Lot n°50"));
        assertEquals(List.of(8L), vue.commandes());
        assertEquals(List.of("COLLECTE", "LIVRAISON"), vue.etapes().stream().map(EtapeVue::type).toList());

        commande.setStatut(StatutLivraison.AFFECTEE);
        service.accepter(sami.getEmail(), 70L);
        verify(workflow, times(1)).transition(any(), any(), any(), anyString());
    }

    @Test void offreExpireeOuDUnAutreCoursierRefusee() {
        Lot lot = lot(StatutLot.PROPOSE);
        when(livreurs.findByEmail(sami.getEmail())).thenReturn(Optional.of(sami));
        when(offres.verrouiller(70L)).thenReturn(Optional.of(offre(lot, sami, Instant.now().minusSeconds(1))));
        assertEquals(409, assertThrows(MarketplaceException.class, () -> service.accepter(sami.getEmail(), 70L)).getStatut());

        Livreur autre = livreur(); autre.setId(9L);
        when(offres.verrouiller(71L)).thenReturn(Optional.of(offre(lot, autre, Instant.now().plusSeconds(50))));
        assertEquals(404, assertThrows(MarketplaceException.class, () -> service.accepter(sami.getEmail(), 71L)).getStatut());
        verifyNoInteractions(workflow);
    }

    @Test void refusExclutLeCoursierEtReproposeAuSuivant() {
        Lot lot = lot(StatutLot.PROPOSE);
        OffreLot offre = offre(lot, sami, Instant.now().plusSeconds(50));
        Livreur nour = livreur(); nour.setId(9L); nour.setEmail("nour@test.tn"); nour.placer(36.81, 10.19, Instant.now());
        when(livreurs.findByEmail(sami.getEmail())).thenReturn(Optional.of(sami));
        when(offres.verrouiller(70L)).thenReturn(Optional.of(offre));
        when(lots.verrouiller(50L)).thenReturn(Optional.of(lot));
        when(lots.findAllByStatutOrderByIdAsc(StatutLot.PROPOSE)).thenReturn(List.of(lot));
        when(commandes.findAllByLotIdOrderByIdAsc(50L)).thenReturn(List.of(commande));
        when(affectations.findAllByZoneId(2L)).thenReturn(List.of(affectation(sami, TypeAffectation.PRINCIPALE),
                affectation(nour, TypeAffectation.SECONDAIRE)));
        when(offres.save(any())).thenAnswer(i -> i.getArgument(0));

        service.refuser(sami.getEmail(), 70L, new RefusOffreRequest("  Trop loin  "));

        assertEquals(StatutOffre.REFUSEE, offre.getStatut());
        assertEquals("Trop loin", offre.getMotifRefus());
        assertEquals(Set.of(4L), lot.exclus());
        verify(offres).save(argThat(o -> o.getLivreur().getId().equals(9L)));
        assertThrows(IllegalArgumentException.class,
                () -> service.refuser(sami.getEmail(), 70L, new RefusOffreRequest("x".repeat(301))));
    }

    @Test void debordementVersUneZoneVoisineSignaleHorsZone() {
        Zone voisine = new Zone(); voisine.setId(3L); voisine.setNom("La Marsa");
        voisine.definirPolygone(ZoneService.polygone(List.of(new com.fleetpulse.livraison.Dto.MarketplaceDto.Position(37., 10.),
                new com.fleetpulse.livraison.Dto.MarketplaceDto.Position(37., 11.), new com.fleetpulse.livraison.Dto.MarketplaceDto.Position(38., 11.),
                new com.fleetpulse.livraison.Dto.MarketplaceDto.Position(38., 10.))));
        Lot lot = lot(StatutLot.PROPOSE);
        AffectationZone renfort = affectation(sami, TypeAffectation.PRINCIPALE); renfort.setZone(voisine);
        when(lots.findAllByStatutOrderByIdAsc(StatutLot.PROPOSE)).thenReturn(List.of(lot));
        when(commandes.findAllByLotIdOrderByIdAsc(50L)).thenReturn(List.of(commande));
        when(zones.findAllByOrderByIdAsc()).thenReturn(List.of(zone(), voisine));
        doReturn(List.of()).when(affectations).findAllByZoneId(2L);
        doReturn(List.of(renfort)).when(affectations).findAllByZoneId(3L);
        when(offres.save(any())).thenAnswer(i -> i.getArgument(0));

        service.cycle();

        verify(offres).save(argThat(OffreLot::isHorsZone));
    }

    @Test void cycleExpireLesOffresEchues() {
        Lot lot = lot(StatutLot.PROPOSE);
        OffreLot echue = offre(lot, sami, Instant.now().minusSeconds(5));
        when(offres.findAllByStatutAndExpireLeBeforeOrderByIdAsc(eq(StatutOffre.EN_ATTENTE), any())).thenReturn(List.of(echue));
        when(offres.verrouiller(70L)).thenReturn(Optional.of(echue));

        CycleVue cycle = service.cycle();

        assertEquals(1, cycle.offresExpirees());
        assertEquals(StatutOffre.EXPIREE, echue.getStatut());
        assertTrue(lot.exclus().contains(4L));
        verify(entrepot).enregistrer(eq(TypeEvenement.OFFRE), isNull(), eq(4L), isNull(), eq(50L), anyDouble(), eq("EXPIREE"), isNull());
    }

    @Test void indisponibiliteRetireLesOffresEnAttente() {
        Lot lot = lot(StatutLot.PROPOSE);
        OffreLot enAttente = offre(lot, sami, Instant.now().plusSeconds(30));
        when(offres.findAllByLivreurIdAndStatutOrderByIdAsc(4L, StatutOffre.EN_ATTENTE)).thenReturn(List.of(enAttente));
        service.livreurIndisponible(sami);
        assertEquals(StatutOffre.ANNULEE, enAttente.getStatut());
    }

    @Test void affectationForceeAnnuleLOffreEtEstAuditee() {
        Lot ancien = lot(StatutLot.PROPOSE);
        OffreLot enCours = offre(ancien, livreur(), Instant.now().plusSeconds(30));
        Responsable ops = new Responsable(); ops.setEmail("ops@test.tn"); ops.setRole(Role.RESPONSABLE);
        when(utilisateurs.findByEmail("ops@test.tn")).thenReturn(Optional.of(ops));
        when(commandes.verrouiller(8L)).thenReturn(Optional.of(commande));
        when(livreurs.findById(4L)).thenReturn(Optional.of(sami));
        when(lots.verrouiller(50L)).thenReturn(Optional.of(ancien));
        when(offres.findAllByLotIdAndStatut(50L, StatutOffre.EN_ATTENTE)).thenReturn(List.of(enCours));

        service.forcer("ops@test.tn", 8L, new ForcerRequest(4L, "Client prioritaire"));

        assertEquals(StatutOffre.ANNULEE, enCours.getStatut());
        assertEquals(StatutLot.ANNULE, ancien.getStatut());
        assertEquals("FORCE", commande.getLot().getSource());
        assertEquals(StatutLot.ACCEPTE, commande.getLot().getStatut());
        verify(workflow).transition(eq(commande), eq(StatutLivraison.AFFECTEE), eq(ops), contains("Client prioritaire"));
        verify(audit).enregistrer(eq(ActionAudit.AFFECTATION_FORCEE), eq("COMMANDE"), eq(8L), contains("Sami"));
    }

    @Test void affectationForceeRefuseeSansMotifOuCommandeDejaAffectee() {
        assertThrows(IllegalArgumentException.class, () -> service.forcer("ops@test.tn", 8L, new ForcerRequest(4L, "abc")));
        assertThrows(IllegalArgumentException.class, () -> service.forcer("ops@test.tn", 8L, new ForcerRequest(null, "Client prioritaire")));
        when(utilisateurs.findByEmail("ops@test.tn")).thenReturn(Optional.of(new Responsable()));
        commande.setStatut(StatutLivraison.AFFECTEE);
        when(commandes.verrouiller(8L)).thenReturn(Optional.of(commande));
        assertEquals(409, assertThrows(MarketplaceException.class,
                () -> service.forcer("ops@test.tn", 8L, new ForcerRequest(4L, "Client prioritaire"))).getStatut());
        verifyNoInteractions(workflow, audit);
    }

    @Test void supervisionSignaleLesCommandesEnAttenteTropLongtemps() {
        commande.setPreteLe(Instant.now().minusSeconds(15 * 60));
        when(commandes.findAllByStatutAndLivreurIsNullOrderByPreteLeAscIdAsc(StatutLivraison.PRETE)).thenReturn(List.of(commande));
        when(livreurs.findAll()).thenReturn(List.of(sami));

        SupervisionVue vue = service.supervision();

        assertTrue(vue.parLots());
        assertEquals(1, vue.enAttente().size());
        assertTrue(vue.enAttente().getFirst().alerte());
        assertTrue(vue.enAttente().getFirst().minutesAttente() >= 15);
        assertEquals(List.of(4L), vue.livreurs().stream().map(LivreurSupervisionVue::id).toList());
    }
}
