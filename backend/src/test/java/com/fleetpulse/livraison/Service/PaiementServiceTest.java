package com.fleetpulse.livraison.Service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fleetpulse.livraison.Config.StripeProperties;
import com.fleetpulse.livraison.Dto.PaiementResponse;
import com.fleetpulse.livraison.Model.Client;
import com.fleetpulse.livraison.Model.Livraison;
import com.fleetpulse.livraison.Model.enums.ModePaiement;
import com.fleetpulse.livraison.Model.enums.StatutPaiement;
import com.fleetpulse.livraison.Repository.LivraisonRepository;
import com.fleetpulse.livraison.Service.StripeService.PaiementException;
import com.stripe.model.PaymentIntent;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class PaiementServiceTest {
    private final LivraisonRepository repository = mock(LivraisonRepository.class);
    private final StripeService stripe = mock(StripeService.class);
    private final PaiementService service = new PaiementService(repository, stripe,
            new StripeProperties("sk_test_x", "pk_test_x", null, "tnd"));
    private Livraison livraison;

    @BeforeEach
    void commandeCarte() {
        Client client = new Client();
        client.setEmail("client@test.tn");
        livraison = new Livraison();
        livraison.setId(7L);
        livraison.setCodeSuivi("FP-TEST");
        livraison.setClient(client);
        livraison.setModePaiement(ModePaiement.CARTE);
        livraison.setStatutPaiement(StatutPaiement.EN_ATTENTE);
        livraison.setFraisLivraison(6.8);
        livraison.setSupplementImmediat(3.4);
        when(repository.findById(7L)).thenReturn(Optional.of(livraison));
        when(stripe.actif()).thenReturn(true);
        when(stripe.devise()).thenReturn("tnd");
    }

    private static PaymentIntent intention(String id, String statut) {
        PaymentIntent intention = new PaymentIntent();
        intention.setId(id);
        intention.setStatus(statut);
        intention.setClientSecret(id + "_secret");
        return intention;
    }

    @Test
    void montantEnMillimesPourLeDinarEtCentimesPourLEuro() {
        assertEquals(10_200, StripeService.montantStripe(10.2, "tnd"));
        assertEquals(0, StripeService.montantStripe(10.2, "tnd") % 10);
        assertEquals(1_020, StripeService.montantStripe(10.2, "eur"));
        assertEquals(10, StripeService.montantStripe(10.2, "jpy"));
    }

    @Test
    void demarrerCreeUnPaymentIntentAvecLeTotalEnregistre() {
        when(stripe.creerIntention(eq(10.2), anyString(), eq("7"))).thenReturn(intention("pi_1", "requires_payment_method"));

        PaiementResponse reponse = service.demarrer(7L, "client@test.tn");

        assertEquals("pi_1_secret", reponse.clientSecret());
        assertEquals(10.2, reponse.montant());
        assertFalse(reponse.dejaPaye());
        assertEquals("pi_1", livraison.getStripePaymentIntentId());
    }

    @Test
    void demarrerReutiliseLIntentionExistante() {
        livraison.setStripePaymentIntentId("pi_1");
        when(stripe.lireIntention("pi_1")).thenReturn(intention("pi_1", "requires_payment_method"));

        assertEquals("pi_1_secret", service.demarrer(7L, "client@test.tn").clientSecret());
        verify(stripe, never()).creerIntention(anyDouble(), anyString(), anyString());
    }

    @Test
    void demarrerSurUneIntentionDejaEncaisseeMarqueLaCommandePayee() {
        livraison.setStripePaymentIntentId("pi_1");
        when(stripe.lireIntention("pi_1")).thenReturn(intention("pi_1", "succeeded"));

        PaiementResponse reponse = service.demarrer(7L, "client@test.tn");

        assertTrue(reponse.dejaPaye());
        assertNull(reponse.clientSecret());
        assertEquals(StatutPaiement.PAYE, livraison.getStatutPaiement());
    }

    @Test
    void verifierSuitLeStatutStripe() {
        livraison.setStripePaymentIntentId("pi_1");
        when(stripe.lireIntention("pi_1")).thenReturn(intention("pi_1", "succeeded"));
        assertEquals(StatutPaiement.PAYE, service.verifier(7L, "client@test.tn").statutPaiement());
    }

    @Test
    void paiementAbandonneResteEnAttente() {
        livraison.setStripePaymentIntentId("pi_1");
        when(stripe.lireIntention("pi_1")).thenReturn(intention("pi_1", "requires_payment_method"));
        assertEquals(StatutPaiement.EN_ATTENTE, service.verifier(7L, "client@test.tn").statutPaiement());
    }

    @Test
    void unAutreClientNePeutPasPayerLaCommande() {
        assertThrows(PaiementException.class, () -> service.demarrer(7L, "autre@test.tn"));
    }

    @Test
    void commandeAPayerALaLivraisonRefusee() {
        livraison.setModePaiement(ModePaiement.COD);
        assertThrows(PaiementException.class, () -> service.demarrer(7L, "client@test.tn"));
    }
}
