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
    @ExceptionHandler(org.springframework.web.bind.MissingServletRequestParameterException.class)
    ResponseEntity<ErreurResponse> parametreManquant(Exception e) {
        return ResponseEntity.badRequest().body(new ErreurResponse("DONNEES_INVALIDES", "Paramètre obligatoire manquant."));
    }
    @ExceptionHandler(org.springframework.dao.ConcurrencyFailureException.class)
    ResponseEntity<ErreurResponse> concurrence(Exception e) {
        return ResponseEntity.status(409).body(new ErreurResponse("ETAT_INVALIDE", "Modification concurrente. Réessayez la même opération."));
    }
    @ExceptionHandler(com.fleetpulse.livraison.Service.MarketplaceException.class)
    ResponseEntity<ErreurResponse> marketplace(com.fleetpulse.livraison.Service.MarketplaceException e) {
        return ResponseEntity.status(e.getStatut()).body(new ErreurResponse(e.getCode(), e.getMessage()));
    }

    @ExceptionHandler(org.springframework.web.server.ResponseStatusException.class)
    ResponseEntity<ErreurResponse> serviceIndisponible(org.springframework.web.server.ResponseStatusException exception) {
        return ResponseEntity.status(exception.getStatusCode())
                .body(new ErreurResponse("SERVICE_INDISPONIBLE", exception.getReason()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<ErreurResponse> donneesInvalides(IllegalArgumentException exception) {
        return ResponseEntity.badRequest().body(new ErreurResponse("DONNEES_INVALIDES", exception.getMessage()));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ErreurResponse> corpsIllisible(HttpMessageNotReadableException exception) {
        return ResponseEntity.badRequest()
                .body(new ErreurResponse("DONNEES_INVALIDES", "Requête mal formée."));
    }

    @ExceptionHandler(org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class)
    ResponseEntity<ErreurResponse> parametreInvalide(Exception exception) {
        return ResponseEntity.badRequest().body(new ErreurResponse("DONNEES_INVALIDES", "Filtre ou date invalide."));
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
                .body(new ErreurResponse("COMPTE_INACTIF", "Votre compte est suspendu. Contactez le responsable pour sa réactivation."));
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
