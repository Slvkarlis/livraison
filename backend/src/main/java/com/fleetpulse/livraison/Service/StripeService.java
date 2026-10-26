package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Config.StripeProperties;
import com.stripe.StripeClient;
import com.stripe.exception.StripeException;
import com.stripe.model.PaymentIntent;
import com.stripe.param.PaymentIntentCreateParams;
import jakarta.annotation.PostConstruct;
import java.util.Locale;
import java.util.Set;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/** Acces a l'API Stripe (PaymentIntents), isole pour pouvoir etre remplace dans les tests. */
@Service
public class StripeService {
    private static final Set<String> DEVISES_TROIS_DECIMALES = Set.of("bhd", "jod", "kwd", "omr", "tnd");
    private static final Set<String> DEVISES_SANS_DECIMALE = Set.of(
            "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "vnd", "vuv", "xaf", "xof", "xpf");

    @Autowired
    private StripeProperties props;

    private StripeClient client;

    @PostConstruct
    void init() {
        this.client = props.actif() ? new StripeClient(props.cleSecrete()) : null;
    }

    public boolean actif() {
        return client != null;
    }

    public String devise() {
        return props.devise().toLowerCase(Locale.ROOT);
    }

    public PaymentIntent creerIntention(double montant, String description, String livraisonId) {
        PaymentIntentCreateParams params = PaymentIntentCreateParams.builder()
                .setAmount(montantStripe(montant, devise()))
                .setCurrency(devise())
                .setDescription(description)
                .putMetadata("livraisonId", livraisonId)
                .setAutomaticPaymentMethods(PaymentIntentCreateParams.AutomaticPaymentMethods.builder()
                        .setEnabled(true).build())
                .build();
        try {
            return verifierActif().paymentIntents().create(params);
        } catch (StripeException exception) {
            throw new PaiementException("Stripe a refusé la création du paiement : " + exception.getMessage());
        }
    }

    public PaymentIntent lireIntention(String id) {
        try {
            return verifierActif().paymentIntents().retrieve(id);
        } catch (StripeException exception) {
            throw new PaiementException("Paiement introuvable chez Stripe : " + exception.getMessage());
        }
    }

    /**
     * Montant en plus petite unite de la devise : millimes (x1000, dernier chiffre a 0) pour le dinar tunisien,
     * centimes (x100) pour l'euro ou le dollar.
     */
    static long montantStripe(double montant, String devise) {
        if (DEVISES_TROIS_DECIMALES.contains(devise)) return Math.round(montant * 100) * 10;
        if (DEVISES_SANS_DECIMALE.contains(devise)) return Math.round(montant);
        return Math.round(montant * 100);
    }

    private StripeClient verifierActif() {
        if (client == null) throw new PaiementException("Le paiement par carte n'est pas configuré sur le serveur.");
        return client;
    }

    /** Erreur de paiement affichable au client (400). */
    public static class PaiementException extends IllegalArgumentException {
        public PaiementException(String message) {
            super(message);
        }
    }
}
