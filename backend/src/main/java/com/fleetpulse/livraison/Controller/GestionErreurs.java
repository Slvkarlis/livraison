package com.fleetpulse.livraison.Controller;

import com.fleetpulse.livraison.Dto.ErreurResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
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

    @ExceptionHandler(Exception.class)
    ResponseEntity<ErreurResponse> erreurInterne(Exception exception) {
        log.error("Erreur non geree", exception);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErreurResponse("ERREUR_INTERNE", "Erreur du serveur, réessayez plus tard."));
    }
}
