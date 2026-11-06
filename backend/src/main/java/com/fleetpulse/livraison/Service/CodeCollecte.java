package com.fleetpulse.livraison.Service;

import java.security.SecureRandom;

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
}
