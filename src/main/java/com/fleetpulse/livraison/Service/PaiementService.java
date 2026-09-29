package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Config.StripeProperties;
import com.fleetpulse.livraison.Dto.LivraisonResponse;
import com.fleetpulse.livraison.Dto.PaiementConfigResponse;
import com.fleetpulse.livraison.Dto.PaiementResponse;
import com.fleetpulse.livraison.Model.Livraison;
import com.fleetpulse.livraison.Model.enums.ModePaiement;
import com.fleetpulse.livraison.Model.enums.StatutPaiement;
import com.fleetpulse.livraison.Repository.LivraisonRepository;
import com.fleetpulse.livraison.Service.StripeService.PaiementException;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.model.PaymentIntent;
import com.stripe.net.Webhook;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Paiement par carte avec Stripe : la commande est creee "EN_ATTENTE", l'application affiche la PaymentSheet
 * avec le client_secret, puis le serveur verifie aupres de Stripe (et/ou via le webhook) que le paiement a reussi.
 * Le montant vient toujours de la commande enregistree, jamais du telephone.
 */
@Service
public class PaiementService {
    private static final Logger log = LoggerFactory.getLogger(PaiementService.class);

    private final LivraisonRepository livraisonRepository;
    private final StripeService stripe;
    private final StripeProperties props;

    public PaiementService(LivraisonRepository livraisonRepository, StripeService stripe, StripeProperties props) {
        this.livraisonRepository = livraisonRepository;
        this.stripe = stripe;
        this.props = props;
    }

    public PaiementConfigResponse config() {
        return new PaiementConfigResponse(stripe.actif(), stripe.actif() ? props.clePublique() : null, stripe.devise());
    }

    @Transactional
    public PaiementResponse demarrer(Long livraisonId, String clientEmail) {
        Livraison livraison = livraisonDuClient(livraisonId, clientEmail);
        if (livraison.getModePaiement() != ModePaiement.CARTE) {
            throw new PaiementException("Cette commande se paie à la livraison.");
        }
        if (livraison.getStatutPaiement() == StatutPaiement.PAYE) {
            throw new PaiementException("Cette commande est déjà payée.");
        }

        PaymentIntent intention = null;
        if (livraison.getStripePaymentIntentId() != null) {
            intention = stripe.lireIntention(livraison.getStripePaymentIntentId());
            if ("succeeded".equals(intention.getStatus())) {
                // Paye mais pas encore verifie (application fermee trop tot) : on enregistre sans exception,
                // sinon la transaction serait annulee.
                livraison.setStatutPaiement(StatutPaiement.PAYE);
                return new PaiementResponse(null, LivraisonResponse.total(livraison), stripe.devise(), true);
            }
            if ("canceled".equals(intention.getStatus())) intention = null;
        }
        if (intention == null) {
            intention = stripe.creerIntention(LivraisonResponse.total(livraison),
                    "FleetPulse " + livraison.getCodeSuivi(), String.valueOf(livraison.getId()));
            livraison.setStripePaymentIntentId(intention.getId());
        }
        livraison.setStatutPaiement(StatutPaiement.EN_ATTENTE);
        return new PaiementResponse(intention.getClientSecret(), LivraisonResponse.total(livraison), stripe.devise(), false);
    }

    /** Appele par l'application apres la PaymentSheet : le statut vient de Stripe, pas du telephone. */
    @Transactional
    public LivraisonResponse verifier(Long livraisonId, String clientEmail) {
        Livraison livraison = livraisonDuClient(livraisonId, clientEmail);
        if (livraison.getStripePaymentIntentId() == null) {
            throw new PaiementException("Aucun paiement n'a été démarré pour cette commande.");
        }
        appliquerStatut(livraison, stripe.lireIntention(livraison.getStripePaymentIntentId()).getStatus());
        return LivraisonResponse.from(livraison);
    }

    /** Webhook Stripe (payment_intent.*), utile si l'application se ferme avant la verification. */
    @Transactional
    public void webhook(String corps, String signature) {
        if (props.cleWebhook() == null || props.cleWebhook().isBlank()) {
            throw new PaiementException("Webhook Stripe non configuré.");
        }
        if (signature == null || signature.isBlank()) throw new PaiementException("Signature Stripe manquante.");
        Event evenement;
        try {
            evenement = Webhook.constructEvent(corps, signature, props.cleWebhook());
        } catch (SignatureVerificationException exception) {
            throw new PaiementException("Signature Stripe invalide.");
        }
        if (!evenement.getType().startsWith("payment_intent.")) return;
        evenement.getDataObjectDeserializer().getObject()
                .filter(PaymentIntent.class::isInstance)
                .map(PaymentIntent.class::cast)
                .ifPresent(intention -> livraisonRepository.findByStripePaymentIntentId(intention.getId())
                        .ifPresent(livraison -> appliquerStatut(livraison, intention.getStatus())));
    }

    private void appliquerStatut(Livraison livraison, String statutStripe) {
        StatutPaiement statut = switch (statutStripe) {
            case "succeeded" -> StatutPaiement.PAYE;
            case "canceled" -> StatutPaiement.ECHOUE;
            default -> StatutPaiement.EN_ATTENTE;   // requires_payment_method, processing, requires_action...
        };
        if (statut != livraison.getStatutPaiement()) {
            log.info("Commande {} : paiement {} -> {}", livraison.getCodeSuivi(), livraison.getStatutPaiement(), statut);
            livraison.setStatutPaiement(statut);
        }
    }

    private Livraison livraisonDuClient(Long livraisonId, String clientEmail) {
        return livraisonRepository.findById(livraisonId)
                .filter(l -> l.getClient().getEmail().equals(clientEmail))
                .orElseThrow(() -> new PaiementException("Commande introuvable."));
    }
}
