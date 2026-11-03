package com.fleetpulse.livraison;
import static org.junit.jupiter.api.Assertions.*;
import com.fleetpulse.livraison.Repository.*;
import com.fleetpulse.livraison.Service.Sprint2DemoInitializer;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@ActiveProfiles("demo")
@SpringBootTest(properties = { "app.demo.enabled=true", "app.sprint2.donnees-demo=true",
        "spring.datasource.url=jdbc:h2:mem:sprint2demo;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1" })
class Sprint2DemoTest {
    @Autowired ZoneRepository zones;
    @Autowired PartenaireRepository partenaires;
    @Autowired ProduitRepository produits;
    @Autowired UtilisateurRepository utilisateurs;
    @Autowired Sprint2DemoInitializer demo;
    @Test void donneesCompletesEtRelanceSansReinitialisation() {
        assertEquals(1,zones.count()); assertEquals(2,partenaires.count());assertEquals(10,produits.count());
        assertTrue(utilisateurs.existsByEmail("client@sprint2.demo"));
        for(var p:partenaires.findAll()) { assertTrue(p.getOuvert());assertNotNull(p.getZone());assertEquals(5,produits.findAllByPartenaireIdOrderByIdAsc(p.getId()).size()); }
        demo.run();assertEquals(1,zones.count());assertEquals(2,partenaires.count());assertEquals(10,produits.count());
    }
}
