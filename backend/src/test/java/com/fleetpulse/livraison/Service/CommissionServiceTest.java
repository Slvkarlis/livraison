package com.fleetpulse.livraison.Service;

import static com.fleetpulse.livraison.support.DonneesTest.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.fleetpulse.livraison.Dto.FinanceDto.TauxRequest;
import com.fleetpulse.livraison.Model.TauxCommission;
import com.fleetpulse.livraison.Model.enums.ActionAudit;
import com.fleetpulse.livraison.Model.enums.PorteeCommission;
import com.fleetpulse.livraison.Repository.*;
import java.math.BigDecimal;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

/** US-502 : le taux le plus specifique l'emporte ; US-501 : 12 % par defaut. */
@ExtendWith(MockitoExtension.class)
class CommissionServiceTest {
    @Mock TauxCommissionRepository taux; @Mock PartenaireRepository partenaires; @Mock AuditService audit;
    @InjectMocks CommissionService service;

    TauxCommission t(PorteeCommission portee, String valeur) {
        TauxCommission t = new TauxCommission(); t.setPortee(portee); t.setTaux(new BigDecimal(valeur)); return t;
    }

    @Test void partenairePuisCategoriePuisGlobalPuisDefaut() {
        assertEquals(new BigDecimal("12.00"), service.tauxApplicable(partenaire()));
        when(taux.findFirstByPortee(PorteeCommission.GLOBAL)).thenReturn(Optional.of(t(PorteeCommission.GLOBAL, "11.00")));
        assertEquals(new BigDecimal("11.00"), service.tauxApplicable(partenaire()));
        when(taux.findFirstByPorteeAndCategorie(PorteeCommission.CATEGORIE, "restaurant")).thenReturn(Optional.of(t(PorteeCommission.CATEGORIE, "10.00")));
        assertEquals(new BigDecimal("10.00"), service.tauxApplicable(partenaire()), "categorie « Restaurant » sans tenir compte de la casse");
        when(taux.findFirstByPorteeAndPartenaireId(PorteeCommission.PARTENAIRE, 3L)).thenReturn(Optional.of(t(PorteeCommission.PARTENAIRE, "8.50")));
        assertEquals(new BigDecimal("8.50"), service.tauxApplicable(partenaire()));
        assertEquals(new BigDecimal("11.00"), service.tauxApplicable(null), "commande sans commerce : taux global");
    }

    @Test void definirParPorteeEtAuditer() {
        when(taux.findFirstByPorteeAndCategorie(PorteeCommission.CATEGORIE, "epicerie")).thenReturn(Optional.empty());
        var vue = service.definir("finance@test.tn", new TauxRequest(PorteeCommission.CATEGORIE, "  Epicerie ", null, new BigDecimal("9.5")));
        assertEquals("epicerie", vue.categorie());
        assertEquals(new BigDecimal("9.50"), vue.taux());
        verify(taux).save(argThat(t -> t.getModifiePar().equals("finance@test.tn")));
        verify(audit).enregistrer(eq(ActionAudit.COMMISSION_MODIFIEE), eq("COMMISSION"), any(), contains("9.50 %"));

        when(partenaires.findById(3L)).thenReturn(Optional.of(partenaire()));
        when(taux.findFirstByPorteeAndPartenaireId(PorteeCommission.PARTENAIRE, 3L)).thenReturn(Optional.of(t(PorteeCommission.PARTENAIRE, "10.00")));
        var remplace = service.definir("finance@test.tn", new TauxRequest(PorteeCommission.PARTENAIRE, null, 3L, new BigDecimal("7")));
        assertEquals("Chez Amira", remplace.nomCommerce());
        verify(audit).enregistrer(eq(ActionAudit.COMMISSION_MODIFIEE), eq("COMMISSION"), any(), contains("10.00 % → 7.00 %"));
    }

    @Test void requetesInvalides() {
        assertThrows(IllegalArgumentException.class, () -> service.definir("f", null));
        assertThrows(IllegalArgumentException.class, () -> service.definir("f", new TauxRequest(PorteeCommission.GLOBAL, null, null, new BigDecimal("120"))));
        assertThrows(IllegalArgumentException.class, () -> service.definir("f", new TauxRequest(PorteeCommission.CATEGORIE, " ", null, BigDecimal.TEN)));
        assertThrows(IllegalArgumentException.class, () -> service.definir("f", new TauxRequest(PorteeCommission.PARTENAIRE, null, null, BigDecimal.TEN)));
        when(partenaires.findById(99L)).thenReturn(Optional.empty());
        assertEquals(404, assertThrows(MarketplaceException.class,
                () -> service.definir("f", new TauxRequest(PorteeCommission.PARTENAIRE, null, 99L, BigDecimal.TEN))).getStatut());
        verifyNoInteractions(audit);
    }

    @Test void suppressionAuditee() {
        TauxCommission global = t(PorteeCommission.GLOBAL, "11.00"); global.setId(5L);
        when(taux.findById(5L)).thenReturn(Optional.of(global));
        service.supprimer(5L);
        verify(taux).delete(global);
        verify(audit).enregistrer(ActionAudit.COMMISSION_SUPPRIMEE, "COMMISSION", 5L, "Taux global : 11.00 %");
        when(taux.findById(6L)).thenReturn(Optional.empty());
        assertThrows(MarketplaceException.class, () -> service.supprimer(6L));
    }
}
