package com.fleetpulse.livraison.Service;

import static com.fleetpulse.livraison.Model.enums.StatutLivraison.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.Role;
import com.fleetpulse.livraison.Model.enums.StatutLivraison;
import com.fleetpulse.livraison.Repository.HistoriqueStatutRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;

class CommandeWorkflowTest {
    final HistoriqueStatutRepository historique = mock(HistoriqueStatutRepository.class);
    final ApplicationEventPublisher evenements = mock(ApplicationEventPublisher.class);
    final CommandeWorkflow workflow = new CommandeWorkflow(historique, evenements);

    static Livraison commande(StatutLivraison statut) {
        Client client = new Client(); client.setId(7L); client.setEmail("client@test"); client.setRole(Role.CLIENT);
        Partenaire partenaire = new Partenaire(); partenaire.setId(3L);
        Livraison l = new Livraison(); l.setId(1L); l.setClient(client); l.setPartenaire(partenaire); l.setStatut(statut);
        return l;
    }

    static Partenaire acteur() {
        Partenaire p = new Partenaire(); p.setEmail("partenaire@test"); p.setRole(Role.PARTENAIRE);
        return p;
    }

    @Test void transitionAutoriseeEcritHistoriqueEtPublie() {
        Livraison l = commande(PENDING_PARTNER);
        workflow.transition(l, REFUSEE, acteur(), "RUPTURE");
        assertEquals(REFUSEE, l.getStatut());
        ArgumentCaptor<HistoriqueStatut> h = ArgumentCaptor.forClass(HistoriqueStatut.class);
        verify(historique).save(h.capture());
        assertEquals(PENDING_PARTNER, h.getValue().getAncien());
        assertEquals(REFUSEE, h.getValue().getNouveau());
        assertEquals(Role.PARTENAIRE, h.getValue().getActeurRole());
        assertEquals("RUPTURE", h.getValue().getMotif());
        verify(evenements).publishEvent(new CommandeStatutChange(1L, 3L, 7L, PENDING_PARTNER, REFUSEE));
    }

    @Test void cheminCompletDuSprint2bis() {
        Livraison l = commande(PENDING_PARTNER);
        for (StatutLivraison s : new StatutLivraison[] { ACCEPTEE, EN_PREPARATION, PRETE, AFFECTEE, RECUPEREE })
            workflow.transition(l, s, acteur(), null);
        assertEquals(RECUPEREE, l.getStatut());
        verify(historique, times(5)).save(any());
        assertTrue(CommandeWorkflow.autorisee(ACCEPTEE, PRETE), "prête sans début de préparation explicite");
        assertTrue(CommandeWorkflow.autorisee(ACCEPTEE, ANNULEE));
    }

    @Test void transitionsInterditesRefuseesSansEffet() {
        StatutLivraison[][] interdites = {
                { PENDING_PARTNER, PRETE }, { PENDING_PARTNER, RECUPEREE }, { REFUSEE, ACCEPTEE }, { ANNULEE, ACCEPTEE },
                { EN_PREPARATION, ANNULEE }, { PRETE, ANNULEE }, { AFFECTEE, PRETE }, { LIVREE, ANNULEE }, { RECUPEREE, PENDING_PARTNER } };
        for (StatutLivraison[] t : interdites) {
            Livraison l = commande(t[0]);
            MarketplaceException e = assertThrows(MarketplaceException.class, () -> workflow.transition(l, t[1], acteur(), null),
                    t[0] + " -> " + t[1]);
            assertEquals(409, e.getStatut());
            assertEquals(t[0], l.getStatut());
        }
        verifyNoInteractions(historique, evenements);
    }

    @Test void creationEnregistreLaPremiereEntree() {
        Livraison l = commande(PENDING_PARTNER);
        workflow.creer(l, l.getClient());
        ArgumentCaptor<HistoriqueStatut> h = ArgumentCaptor.forClass(HistoriqueStatut.class);
        verify(historique).save(h.capture());
        assertNull(h.getValue().getAncien());
        assertEquals(PENDING_PARTNER, h.getValue().getNouveau());
        assertEquals(Role.CLIENT, h.getValue().getActeurRole());
    }
}
