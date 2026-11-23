package com.fleetpulse.livraison;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

/** Sprint 8 : reentrainement des modeles (US-806). Le service IA n'est pas lance dans les tests : le repli est verifie. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=jdbc:h2:mem:sprint8reentrainer;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
        "app.sprint2.donnees-demo=false", "app.commandes.intervalle-secondes=0", "app.commandes.actives-max=10" })
class Sprint8ReentrainerTest extends ParcoursSprint3 {

    @Test void modeleInconnuEstRefuse() throws Exception {
        succes(400, appel("POST", "/admin/ia/reentrainer/meteo", null, admin));
    }

    @Test void serviceIaIndisponibleNeModifiePas() throws Exception {
        succes(409, appel("POST", "/admin/ia/reentrainer/prospection", null, admin));
        succes(409, appel("POST", "/admin/ia/reentrainer/demande", null, admin));
    }

    @Test void reservéAuxOperations() throws Exception {
        succes(403, appel("POST", "/admin/ia/reentrainer/demande", null, client));
    }
}
