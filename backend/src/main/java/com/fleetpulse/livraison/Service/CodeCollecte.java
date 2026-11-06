package com.fleetpulse.livraison.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Locale;

/**
 * Code de collecte d'un colis (US-2B10) : imprime en QR sur l'etiquette par le partenaire,
 * scanne (ou saisi) par le coursier pour confirmer la prise en charge (US-2B9).
 *
 * <p>Le code est conserve en clair car le partenaire doit pouvoir reimprimer l'etiquette.
 * Il n'est accepte qu'une fois, par le coursier affecte, tant que la commande attend sa collecte.
 */
public final class CodeCollecte {
    /** Sans 0/O ni 1/I/L : le code reste lisible et saisissable a la main. */
    static final String ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    static final int LONGUEUR = 6;
    /** Contenu du QR : FLEETPULSE|<code de suivi>|<code de collecte> (le coursier verifie qu'il scanne le bon colis). */
    static final String PREFIXE_QR = "FLEETPULSE";

    private static final SecureRandom ALEATOIRE = new SecureRandom();

    private CodeCollecte() { }

    public static String generer() {
        StringBuilder code = new StringBuilder(LONGUEUR);
        for (int i = 0; i < LONGUEUR; i++) code.append(ALPHABET.charAt(ALEATOIRE.nextInt(ALPHABET.length())));
        return code.toString();
    }

    public static String contenuQr(String codeSuivi, String code) {
        return PREFIXE_QR + "|" + codeSuivi + "|" + code;
    }

    /**
     * Lit ce que le coursier envoie : le contenu du QR scanne, ou le code saisi a la main
     * (majuscules et espaces toleres). Un QR d'une autre commande est refuse avec un message explicite.
     */
    public static String lire(String saisie, String codeSuiviAttendu) {
        if (saisie == null || saisie.isBlank()) throw new IllegalArgumentException("Scannez le QR du colis ou saisissez son code.");
        String texte = saisie.trim();
        if (!texte.startsWith(PREFIXE_QR + "|")) return texte.replace(" ", "").toUpperCase(Locale.ROOT);

        String[] parties = texte.split("\\|");
        if (parties.length != 3) throw new IllegalArgumentException("QR non reconnu : ce n'est pas une étiquette FleetPulse.");
        if (!parties[1].equals(codeSuiviAttendu))
            throw new IllegalArgumentException("Ce colis appartient à une autre commande (" + parties[1] + ").");
        return parties[2].toUpperCase(Locale.ROOT);
    }

    /** Comparaison en temps constant (ne revele pas, par sa duree, combien de caracteres sont justes). */
    public static boolean correspond(String attendu, String recu) {
        return attendu != null && recu != null
                && MessageDigest.isEqual(attendu.getBytes(StandardCharsets.UTF_8), recu.getBytes(StandardCharsets.UTF_8));
    }
}
