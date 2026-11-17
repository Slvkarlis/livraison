package com.fleetpulse.livraison.Service;

import static org.junit.jupiter.api.Assertions.*;
import com.fleetpulse.livraison.Service.EstimationArrivee.Point;
import com.fleetpulse.livraison.Service.Itineraire.*;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.Test;

/** US-404 : ordre optimal des arrets d'un lot sous contrainte de duree a bord. */
class ItineraireTest {
    // Deux commerces voisins au centre de Tunis, deux clients au nord (environ 1 km et 2 km)
    final Point commerceA = new Point(36.800, 10.180), commerceB = new Point(36.801, 10.181);
    final Point clientA = new Point(36.810, 10.180), clientB = new Point(36.820, 10.180);

    @Test void collecteToujoursAvantLivraisonEtTourneeLaPlusCourte() {
        var r = Itineraire.optimiser(null, List.of(new Course(1L, commerceA, clientA), new Course(2L, commerceB, clientB)),
                20, Duration.ofMinutes(35)).orElseThrow();
        // Les deux collectes d'abord (commerces voisins), puis le client le plus proche, puis le plus loin
        assertEquals("C:1;C:2;L:1;L:2", r.code());
        assertEquals(TypeEtape.LIVRAISON, r.etapes().getLast().type());
        assertEquals(2L, r.etapes().getLast().commandeId());
        for (Long id : List.of(1L, 2L)) {
            int collecte = indice(r, id, TypeEtape.COLLECTE), livraison = indice(r, id, TypeEtape.LIVRAISON);
            assertTrue(collecte < livraison, "commande " + id);
        }
        assertTrue(r.livraison(1L).orElseThrow().compareTo(r.livraison(2L).orElseThrow()) < 0);
        // Duree totale : arrivee au dernier client plus le temps de remise
        assertEquals(r.etapes().getLast().arrivee().plus(Itineraire.TEMPS_ARRET), r.duree());
        assertTrue(r.aBord().get(1L).compareTo(Duration.ofMinutes(35)) <= 0);
    }

    @Test void dureeABordMaximaleRendLeLotImpossible() {
        // Client B a ~2,2 km de son commerce : 5 minutes a bord ne suffisent pas
        assertTrue(Itineraire.optimiser(null, List.of(new Course(1L, commerceA, clientA), new Course(2L, commerceB, clientB)),
                20, Duration.ofMinutes(5)).isEmpty());
        // Sans limite, une tournee existe toujours
        assertTrue(Itineraire.optimiser(null, List.of(new Course(1L, commerceA, clientA)), 20, null).isPresent());
    }

    @Test void departDepuisLeCoursierEtColisDejaABord() {
        Point coursier = new Point(36.805, 10.180);
        var r = Itineraire.optimiser(coursier, List.of(new Course(1L, commerceA, clientA, true), new Course(2L, commerceB, clientB)),
                20, Duration.ofMinutes(35)).orElseThrow();
        // Commande 1 deja a bord : seule sa livraison figure dans l'itineraire
        assertEquals(3, r.etapes().size());
        assertEquals(1, r.etapes().stream().filter(e -> e.commandeId().equals(1L)).count());
        assertTrue(r.etapes().getFirst().arrivee().compareTo(Duration.ZERO) > 0, "trajet depuis la position du coursier");
        assertTrue(r.distanceKm() > 0);
    }

    @Test void decodageDeLItineraireStocke() {
        var arrets = Itineraire.decoder("C:12;C:13;L:12;X:9;L:abc;L:13");
        assertEquals(4, arrets.size());
        assertEquals(new Arret(TypeEtape.COLLECTE, 12L), arrets.getFirst());
        assertEquals(2, Itineraire.compterCommandes("C:12;C:13;L:12;L:13"));
        assertEquals(0, Itineraire.compterCommandes(null));
    }

    @Test void entreesInvalides() {
        assertTrue(Itineraire.optimiser(null, List.of(), 20, null).isEmpty());
        assertTrue(Itineraire.optimiser(null, List.of(new Course(1L, commerceA, clientA)), 0, null).isEmpty());
        var cinq = java.util.stream.LongStream.rangeClosed(1, 5).mapToObj(i -> new Course(i, commerceA, clientA)).toList();
        assertThrows(IllegalArgumentException.class, () -> Itineraire.optimiser(null, cinq, 20, null));
    }

    private static int indice(Resultat r, Long id, TypeEtape type) {
        for (int i = 0; i < r.etapes().size(); i++)
            if (r.etapes().get(i).commandeId().equals(id) && r.etapes().get(i).type() == type) return i;
        return -1;
    }
}
