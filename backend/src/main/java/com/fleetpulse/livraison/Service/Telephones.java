package com.fleetpulse.livraison.Service;

import java.util.regex.Pattern;

/** Format commun des numeros de telephone : chiffres uniquement, "+" initial facultatif. */
public final class Telephones {
    private static final Pattern FORMAT = Pattern.compile("\\+?[0-9]{8,15}");

    private Telephones() {
    }

    /** Retire espaces, points, tirets et parentheses ; null si vide. */
    public static String normaliser(String telephone) {
        if (telephone == null) return null;
        String nettoye = telephone.replaceAll("[\\s.()-]", "");
        return nettoye.isEmpty() ? null : nettoye;
    }

    public static boolean estValide(String telephone) {
        return telephone != null && FORMAT.matcher(telephone).matches();
    }
}
