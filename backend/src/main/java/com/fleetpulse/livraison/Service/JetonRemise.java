package com.fleetpulse.livraison.Service;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * US-305 : QR dynamique affiche par le client pour valider la remise de son colis.
 *
 * <p>Contenu : {@code FLEETPULSE-REMISE|<code commande>|<nonce>|<expiration epoch s>|<signature>}, signe en HMAC-SHA256.
 * <ul>
 *   <li>duree limitee : {@link #DUREE_SECONDES}, l'application en redemande un avant expiration ;</li>
 *   <li>seul le dernier QR genere est valable (nonce garde sur la commande) : une capture partagee plus tot ne sert a rien ;</li>
 *   <li>usage unique : la remise fait passer la commande a LIVREE, aucun QR n'est plus accepte ensuite.</li>
 * </ul>
 */
public final class JetonRemise {
    static final String PREFIXE = "FLEETPULSE-REMISE";
    public static final long DUREE_SECONDES = 120;
    private static final SecureRandom ALEATOIRE = new SecureRandom();
    private static final Base64.Encoder B64 = Base64.getUrlEncoder().withoutPadding();

    private JetonRemise() { }

    public static String nouveauNonce() {
        byte[] octets = new byte[12];
        ALEATOIRE.nextBytes(octets);
        return B64.encodeToString(octets);
    }

    public static String contenu(String codeSuivi, String nonce, Instant expireLe, String secret) {
        String donnees = codeSuivi + "|" + nonce + "|" + expireLe.getEpochSecond();
        return PREFIXE + "|" + donnees + "|" + signer(donnees, secret);
    }

    public static boolean estUnQrDeRemise(String saisie) {
        return saisie != null && saisie.trim().startsWith(PREFIXE + "|");
    }

    /** Leve IllegalArgumentException avec un message lisible par le coursier si le QR n'est pas valable. */
    public static void verifier(String saisie, String codeSuiviAttendu, String nonceCourant, Instant maintenant, String secret) {
        String[] p = saisie.trim().split("\\|");
        if (p.length != 5 || !p[0].equals(PREFIXE)) throw new IllegalArgumentException("QR non reconnu : demandez au client d'afficher son QR de remise.");
        String attendue = signer(p[1] + "|" + p[2] + "|" + p[3], secret);
        if (!MessageDigest.isEqual(attendue.getBytes(StandardCharsets.UTF_8), p[4].getBytes(StandardCharsets.UTF_8)))
            throw new IllegalArgumentException("QR de remise invalide.");
        if (!p[1].equals(codeSuiviAttendu)) throw new IllegalArgumentException("Ce QR concerne une autre commande (" + p[1] + ").");
        long expiration;
        try { expiration = Long.parseLong(p[3]); } catch (NumberFormatException e) { throw new IllegalArgumentException("QR de remise invalide."); }
        if (maintenant.getEpochSecond() > expiration) throw new IllegalArgumentException("QR expiré : demandez au client de l'afficher à nouveau.");
        if (nonceCourant == null || !p[2].equals(nonceCourant))
            throw new IllegalArgumentException("Ce QR a été remplacé : demandez au client d'afficher le QR actuel.");
    }

    static String signer(String donnees, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(("remise:" + secret).getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return B64.encodeToString(mac.doFinal(donnees.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }
}
