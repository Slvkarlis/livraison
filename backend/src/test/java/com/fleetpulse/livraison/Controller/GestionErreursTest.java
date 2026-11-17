package com.fleetpulse.livraison.Controller;

import static org.junit.jupiter.api.Assertions.*;
import com.fleetpulse.livraison.Service.*;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.dao.ConcurrencyFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import com.fleetpulse.livraison.Dto.ErreurResponse;

class GestionErreursTest {
    final GestionErreurs erreurs = new GestionErreurs();
    static Stream<Arguments> erreursMetier() {
        var e = new GestionErreurs();
        return Stream.of(
            Arguments.of(e.donneesInvalides(new IllegalArgumentException("Montant invalide")),400,"DONNEES_INVALIDES"),
            Arguments.of(e.parametreManquant(new Exception()),400,"DONNEES_INVALIDES"),
            Arguments.of(e.parametreInvalide(new Exception()),400,"DONNEES_INVALIDES"),
            Arguments.of(e.concurrence(new ConcurrencyFailureException("verrou")),409,"ETAT_INVALIDE"),
            Arguments.of(e.marketplace(MarketplaceException.absent()),404,"INTROUVABLE"),
            Arguments.of(e.marketplace(MarketplaceException.conflit("État incompatible")),409,"ETAT_INVALIDE"),
            Arguments.of(e.compteIntrouvable(new CompteService.CompteIntrouvableException()),404,"INTROUVABLE"),
            Arguments.of(e.transitionInvalide(new CompteService.TransitionInvalideException("Interdit")),409,"ETAT_INVALIDE"),
            Arguments.of(e.dejaUtilise(new CompteService.DonneeDejaUtiliseeException("Email utilisé")),409,"DEJA_UTILISE"),
            Arguments.of(e.tropDeDemandes(new CodeVerificationService.TropDeDemandesException("Patientez")),429,"TROP_DE_DEMANDES"),
            Arguments.of(e.serviceIndisponible(new org.springframework.web.server.ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Passerelle indisponible")),503,"SERVICE_INDISPONIBLE")
        );
    }
    @ParameterizedTest @MethodSource("erreursMetier")
    void codesEtMessagesRestentCoherents(ResponseEntity<ErreurResponse> reponse, int statut, String code) {
        assertEquals(statut,reponse.getStatusCode().value()); assertNotNull(reponse.getBody());
        assertEquals(code,reponse.getBody().code()); assertNotNull(reponse.getBody().message());
    }
    @Test void erreurInterneNeDivulguePasLesDetailsTechniques() {
        var r=erreurs.erreurInterne(new IllegalStateException("mot-de-passe-ou-requete-SQL-secret"));
        assertEquals(500,r.getStatusCode().value()); assertFalse(r.getBody().message().contains("secret"));
    }
}
