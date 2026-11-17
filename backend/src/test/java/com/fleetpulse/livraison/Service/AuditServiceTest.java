package com.fleetpulse.livraison.Service;

import static com.fleetpulse.livraison.support.DonneesTest.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.fleetpulse.livraison.Model.JournalAudit;
import com.fleetpulse.livraison.Model.enums.ActionAudit;
import com.fleetpulse.livraison.Repository.JournalAuditRepository;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

@ExtendWith(MockitoExtension.class)
class AuditServiceTest {
    @Mock JournalAuditRepository repository; @InjectMocks AuditService service;
    @AfterEach void nettoyer() { SecurityContextHolder.clearContext(); }
    @Test void traceActeurConnecteEtCompteCible() {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("admin@test.tn", null, List.of()));
        service.enregistrer(ActionAudit.LIVREUR_CREE, livreur(), "Création");
        verify(repository).save(argThat(j -> j.getActeur().equals("admin@test.tn") && j.getCibleId().equals(4L)));
    }
    @Test void sansConnexionUtiliseLeCompteOuAnonyme() {
        service.enregistrer(ActionAudit.LIVREUR_CREE, livreur(), null);
        service.enregistrer(ActionAudit.VEHICULE_CREE, "VEHICULE", 5L, null);
        verify(repository).save(argThat(j -> j.getActeur().equals("livreur@test.tn")));
        verify(repository).save(argThat(j -> j.getActeur().equals("anonyme")));
    }
    @Test void rechercheNormaliseEtBorneLaLimite() {
        when(repository.rechercher(eq("admin@test.tn"), isNull(), isNull(), eq(Limit.of(500))))
                .thenReturn(List.of(new JournalAudit("admin@test.tn", ActionAudit.VEHICULE_CREE, "VEHICULE", 5L, "Test")));
        assertEquals(1, service.rechercher(" ADMIN@TEST.TN ", null, null, 1000).size());
        service.rechercher(null, null, null, null); verify(repository).rechercher(null, null, null, Limit.of(200));
    }
    @Test void paginationValideEtParametresInvalides() {
        when(repository.findAll(any(Specification.class), any(Pageable.class))).thenReturn(Page.empty());
        assertTrue(service.page(null, null, null, null, 0, 20).isEmpty());
        verify(repository).findAll(any(Specification.class), eq(PageRequest.of(0, 20, Sort.by(Sort.Direction.DESC, "date", "id"))));
        assertThrows(IllegalArgumentException.class, () -> service.page(null, null, null, null, -1, 20));
        assertThrows(IllegalArgumentException.class, () -> service.page(null, null, null, null, 0, 101));
        assertThrows(IllegalArgumentException.class, () -> service.page(null, null, Instant.now(), Instant.EPOCH, 0, 20));
    }
}
