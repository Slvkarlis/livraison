package com.fleetpulse.livraison.Service;

import static com.fleetpulse.livraison.support.DonneesTest.livreur;
import static org.junit.jupiter.api.Assertions.*;
import com.fleetpulse.livraison.Model.Livreur;
import com.fleetpulse.livraison.Model.enums.TypeAffectation;
import com.fleetpulse.livraison.Service.ChoixLivreur.Candidat;
import java.util.List;
import org.junit.jupiter.api.Test;

/** US-402 : choix du coursier par proximite, charge et zone (secondaire penalisee, debordement en dernier). */
class ChoixLivreurTest {
    Livreur l(long id) { Livreur l = livreur(); l.setId(id); return l; }

    @Test void zonePrincipalePlusProcheGagne() {
        var proche = new Candidat(l(1), TypeAffectation.PRINCIPALE, 0, 0.5);
        var loin = new Candidat(l(2), TypeAffectation.PRINCIPALE, 0, 3.0);
        assertSame(proche, ChoixLivreur.meilleur(List.of(loin, proche)).orElseThrow());
    }

    @Test void zoneSecondairePenaliseeEtDebordementEnDernier() {
        var secondaire = new Candidat(l(1), TypeAffectation.SECONDAIRE, 0, 0.5);
        var principale = new Candidat(l(2), TypeAffectation.PRINCIPALE, 0, 1.5);
        assertSame(principale, ChoixLivreur.meilleur(List.of(secondaire, principale)).orElseThrow(), "0,5 + 1,5 > 1,5");
        var debordement = new Candidat(l(3), null, 0, 0.1);
        assertTrue(debordement.horsZone());
        assertSame(principale, ChoixLivreur.meilleur(List.of(debordement, principale)).orElseThrow());
    }

    @Test void chargePenaliseeEtPositionInconnue() {
        var charge = new Candidat(l(1), TypeAffectation.PRINCIPALE, 2, 0.5);
        var libre = new Candidat(l(2), TypeAffectation.PRINCIPALE, 0, 1.0);
        assertSame(libre, ChoixLivreur.meilleur(List.of(charge, libre)).orElseThrow());
        assertEquals(ChoixLivreur.DISTANCE_INCONNUE_KM, ChoixLivreur.score(new Candidat(l(3), TypeAffectation.PRINCIPALE, 0, null)));
    }

    @Test void egaliteDepartageeParIdentifiantEtListeVide() {
        Candidat a = new Candidat(l(7), TypeAffectation.PRINCIPALE, 0, 1.0), b = new Candidat(l(3), TypeAffectation.PRINCIPALE, 0, 1.0);
        assertSame(b, ChoixLivreur.meilleur(List.of(a, b)).orElseThrow());
        assertTrue(ChoixLivreur.meilleur(List.of()).isEmpty());
    }
}
