package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Model.Client;
import com.fleetpulse.livraison.Model.CodeRemise;
import com.fleetpulse.livraison.Model.Livraison;
import com.fleetpulse.livraison.Repository.CodeRemiseRepository;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * US-310 : code de remise a 6 chiffres, envoye au client par SMS (email s'il n'a pas de telephone).
 * Un nouveau code est cree a la collecte du colis ; le client peut en redemander un, avec un delai et un plafond.
 * Au plus {@link #TENTATIVES_MAX} essais par code : ensuite seul un nouveau code (ou le QR) permet la remise.
 */
@Service @RequiredArgsConstructor @Transactional
public class CodeRemiseService {
    private static final Logger log = LoggerFactory.getLogger(CodeRemiseService.class);
    private static final SecureRandom ALEATOIRE = new SecureRandom();
    static final int TENTATIVES_MAX = 5;
    /** Envoi automatique a la collecte + 3 renvois a la demande du client. */
    static final int ENVOIS_MAX = 4;
    static final long DELAI_RENVOI_SECONDES = 60;

    public enum Resultat { VALIDE, INCORRECT, BLOQUE }

    private final CodeRemiseRepository codes;
    private final PasswordEncoder encodeur;
    private final NotificationSender notifications;

    /** A la collecte : premier code, envoye apres validation de la transaction. */
    public void creerEtEnvoyer(Livraison commande) {
        CodeRemise code = codes.findByCommandeId(commande.getId()).orElseGet(CodeRemise::new);
        envoyerNouveau(commande, code);
    }

    /** Renvoi demande par le client (delai et plafond). Renvoie la date du prochain renvoi possible. */
    public Instant renvoyer(Livraison commande) {
        notifications.verifierDisponible();   // 503 tout de suite plutot qu'un echec silencieux apres validation
        CodeRemise code = codes.findByCommandeId(commande.getId()).orElseGet(CodeRemise::new);
        Instant maintenant = Instant.now();
        if (code.getNbEnvois() >= ENVOIS_MAX)
            throw new MarketplaceException(429, "TROP_DE_DEMANDES", "Nombre maximal d'envois atteint. Affichez votre QR de remise au livreur.");
        if (code.getDernierEnvoiLe() != null && code.getDernierEnvoiLe().isAfter(maintenant.minusSeconds(DELAI_RENVOI_SECONDES)))
            throw new MarketplaceException(429, "TROP_DE_DEMANDES", "Patientez une minute avant de demander un nouveau code.");
        envoyerNouveau(commande, code);
        return code.getNbEnvois() >= ENVOIS_MAX ? null : code.getDernierEnvoiLe().plusSeconds(DELAI_RENVOI_SECONDES);
    }

    /**
     * Verifie le code saisi par le coursier. Transaction separee : un essai rate reste compte
     * meme si la remise echoue ensuite (meme principe que CodeVerificationService).
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Resultat verifier(Long commandeId, String saisie) {
        CodeRemise code = codes.findByCommandeId(commandeId).orElse(null);
        if (code == null || code.getTentatives() >= TENTATIVES_MAX) return Resultat.BLOQUE;
        if (saisie == null || !encodeur.matches(saisie.replace(" ", ""), code.getCodeHash())) {
            code.setTentatives(code.getTentatives() + 1);
            return code.getTentatives() >= TENTATIVES_MAX ? Resultat.BLOQUE : Resultat.INCORRECT;
        }
        return Resultat.VALIDE;
    }

    private void envoyerNouveau(Livraison commande, CodeRemise code) {
        String clair = String.format("%06d", ALEATOIRE.nextInt(1_000_000));
        code.setCommandeId(commande.getId());
        code.setCodeHash(encodeur.encode(clair));
        code.setTentatives(0);
        code.setNbEnvois(code.getNbEnvois() + 1);
        code.setDernierEnvoiLe(Instant.now().truncatedTo(ChronoUnit.MICROS));
        codes.save(code);
        Client client = commande.getClient();
        String message = "FleetPulse : votre code de remise pour la commande " + commande.getCodeSuivi() + " est " + clair
                + ". Ne le donnez au livreur qu'à la réception de votre colis.";
        apresValidation(() -> {
            if (client.getTelephone() != null && !client.getTelephone().isBlank()) notifications.envoyerSms(client.getTelephone(), message);
            else notifications.envoyerEmail(client.getEmail(), "Code de remise " + commande.getCodeSuivi(), message);
        });
    }

    /** Un code ne part jamais pour une operation annulee ; un echec d'envoi n'annule pas la collecte (le client peut redemander). */
    private static void apresValidation(Runnable envoi) {
        Runnable protege = () -> {
            try { envoi.run(); } catch (RuntimeException e) { log.warn("Envoi du code de remise impossible : {}", e.getMessage()); }
        };
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() { protege.run(); }
            });
        } else {
            protege.run();
        }
    }

    /** « SMS au numéro se terminant par 001 » : le client sait ou chercher sans exposer le numero complet. */
    static String destinationMasquee(Client client) {
        String tel = client.getTelephone();
        if (tel != null && tel.replaceAll("\\D", "").length() >= 4) {
            String chiffres = tel.replaceAll("\\D", "");
            return "SMS au numéro se terminant par " + chiffres.substring(chiffres.length() - 3);
        }
        String email = client.getEmail();
        int arobase = email.indexOf('@');
        return "email à " + (arobase > 1 ? email.charAt(0) + "***" + email.substring(arobase) : email);
    }
}
