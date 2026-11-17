package com.fleetpulse.livraison.Controller;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** Exécute le routage HTTP et la sérialisation sans démarrer Spring, MySQL ou le filtre JWT. */
abstract class ControleurTestSupport {
    protected final Authentication utilisateur = new UsernamePasswordAuthenticationToken("utilisateur@test.tn", null);

    protected MockMvc http(Object controleur) {
        return MockMvcBuilders.standaloneSetup(controleur).setControllerAdvice(new GestionErreurs()).build();
    }
}
