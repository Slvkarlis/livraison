package com.fleetpulse.livraison.Service;

import static com.fleetpulse.livraison.support.DonneesTest.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.fleetpulse.livraison.Dto.FinanceDto.BaremeRequest;
import com.fleetpulse.livraison.Model.BaremeZone;
import com.fleetpulse.livraison.Model.enums.ActionAudit;
import com.fleetpulse.livraison.Repository.*;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

/** US-512 : bareme de remuneration par zone, defaut 3 DT + 0,5 DT/km. */
@ExtendWith(MockitoExtension.class)
class BaremeServiceTest {
    @Mock BaremeZoneRepository baremes; @Mock ZoneRepository zones; @Mock AuditService audit;
    @InjectMocks BaremeService service;

    @Test void defautPuisBaremeDeLaZone() {
        assertEquals(new BigDecimal("3.926"), service.remuneration(2L, 1.852));
        assertEquals(new BigDecimal("3.926"), service.remuneration(null, 1.852), "commerce sans zone");
        BaremeZone b = new BaremeZone(); b.setZone(zone()); b.setBase(new BigDecimal("4.000")); b.setParKm(new BigDecimal("0.250"));
        when(baremes.findByZoneId(2L)).thenReturn(Optional.of(b));
        assertEquals(new BigDecimal("4.500"), service.remuneration(2L, 2.0));
        assertFalse(service.bareme(2L).parDefaut());
    }

    @Test void definitionAuditeeEtListe() {
        when(zones.findById(2L)).thenReturn(Optional.of(zone()));
        when(zones.findAllByOrderByIdAsc()).thenReturn(List.of(zone()));
        var vue = service.definir("finance@test.tn", 2L, new BaremeRequest(new BigDecimal("4"), new BigDecimal("0.3")));
        verify(baremes).save(argThat(b -> b.getBase().equals(new BigDecimal("4.000")) && b.getParKm().equals(new BigDecimal("0.300"))));
        verify(audit).enregistrer(eq(ActionAudit.BAREME_MODIFIE), eq("ZONE"), eq(2L), contains("défaut → 4.000 DT + 0.300 DT/km"));
        assertEquals("Tunis", vue.zoneNom());
        assertEquals(1, service.lister().size());
    }

    @Test void montantsInvalidesOuZoneAbsente() {
        assertThrows(IllegalArgumentException.class, () -> service.definir("f", 2L, null));
        assertThrows(IllegalArgumentException.class, () -> service.definir("f", 2L, new BaremeRequest(new BigDecimal("-1"), BigDecimal.ONE)));
        assertThrows(IllegalArgumentException.class, () -> service.definir("f", 2L, new BaremeRequest(BigDecimal.ONE, null)));
        when(zones.findById(9L)).thenReturn(Optional.empty());
        assertThrows(MarketplaceException.class, () -> service.definir("f", 9L, new BaremeRequest(BigDecimal.ONE, BigDecimal.ONE)));
        verifyNoInteractions(audit);
    }
}
