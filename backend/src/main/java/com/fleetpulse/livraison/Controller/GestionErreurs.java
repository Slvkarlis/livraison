package com.fleetpulse.livraison.Controller;

import com.fleetpulse.livraison.Dto.ErreurResponse;
import com.fleetpulse.livraison.Service.CodeVerificationService.TropDeDemandesException;
import com.fleetpulse.livraison.Service.CompteService.CompteIntrouvableException;
import com.fleetpulse.livraison.Service.CompteService.DonneeDejaUtiliseeException;
import com.fleetpulse.livraison.Service.CompteService.TransitionInvalideException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** Toutes les erreurs non gerees deviennent un JSON {code, message} lisible par les applications. */
@RestControllerAdvice
public class GestionErreurs {
    private static final Logger log = LoggerFactory.getLogger(GestionErreurs.class);

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<ErreurResponse> donneesInvalides(IllegalArgumentException exception) {
        return ResponseEntity.badRequest().body(new ErreurResponse("DONNEES_INVALIDES", exception.getMessage()));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ErreurResponse> corpsIllisible(HttpMessageNotReadableException exception) {
        return ResponseEntity.badRequest()
                .body(new ErreurResponse("DONNEES_INVALIDES", "Requête mal formée."));
    }

    // Laisse Spring Security repondre 403 pour un role insuffisant
    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<ErreurResponse> accesRefuse(AccessDeniedException exception) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ErreurResponse("ACCES_REFUSE", "Vous n'avez pas accès à cette action."));
    }

    // Mot de passe correct mais compte suspendu ou refuse
    @ExceptionHandler(DisabledException.class)
    ResponseEntity<ErreurResponse> compteInactif(DisabledException exception) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ErreurResponse("COMPTE_INACTIF", "Votre compte est suspendu ou votre dossier a été refusé."));
    }

    @ExceptionHandler(AuthenticationException.class)
    ResponseEntity<ErreurResponse> authentificationEchouee(AuthenticationException exception) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ErreurResponse("AUTHENTIFICATION_ECHOUEE", "Identifiants ou session invalides."));
    }

    @ExceptionHandler(CompteIntrouvableException.class)
    ResponseEntity<ErreurResponse> compteIntrouvable(CompteIntrouvableException exception) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ErreurResponse("INTROUVABLE", "Compte introuvable."));
    }

    @ExceptionHandler(TransitionInvalideException.class)
    ResponseEntity<ErreurResponse> transitionInvalide(TransitionInvalideException exception) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ErreurResponse("ETAT_INVALIDE", exception.getMessage()));
    }

    @ExceptionHandler(DonneeDejaUtiliseeException.class)
    ResponseEntity<ErreurResponse> dejaUtilise(DonneeDejaUtiliseeException exception) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ErreurResponse("DEJA_UTILISE", exception.getMessage()));
    }

    @ExceptionHandler(TropDeDemandesException.class)
    ResponseEntity<ErreurResponse> tropDeDemandes(TropDeDemandesException exception) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .body(new ErreurResponse("TROP_DE_DEMANDES", exception.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ErreurResponse> erreurInterne(Exception exception) {
        log.error("Erreur non geree", exception);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErreurResponse("ERREUR_INTERNE", "Erreur du serveur, réessayez plus tard."));
    }
}
