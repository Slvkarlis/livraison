package com.fleetpulse.livraison.Service;

import static org.junit.jupiter.api.Assertions.*;

import java.util.HashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;

class CodeCollecteTest {
    @Test void codeDeSixCaracteresSansSymbolesAmbigus() {
        for (char ambigu : "0O1IL".toCharArray())
            assertEquals(-1, CodeCollecte.ALPHABET.indexOf(ambigu), "caractère ambigu exclu : " + ambigu);
        Set<String> codes = new HashSet<>();
        for (int i = 0; i < 1000; i++) {
            String code = CodeCollecte.generer();
            assertTrue(code.matches("[" + CodeCollecte.ALPHABET + "]{6}"), code);
            codes.add(code);
        }
        assertTrue(codes.size() > 990, "codes aléatoires, collisions rarissimes : " + codes.size());
    }

    @Test void contenuDuQrRelieLeColisALaCommande() {
        assertEquals("FLEETPULSE|FP-ABC|K7Q2MX", CodeCollecte.contenuQr("FP-ABC", "K7Q2MX"));
    }

    @Test void lectureDuQrScanneOuDuCodeSaisi() {
        assertEquals("K7Q2MX", CodeCollecte.lire("FLEETPULSE|FP-ABC|K7Q2MX", "FP-ABC"));
        assertEquals("K7Q2MX", CodeCollecte.lire(" k7 q2mx ", "FP-ABC"), "saisie manuelle : casse et espaces tolérés");
        IllegalArgumentException autreColis = assertThrows(IllegalArgumentException.class,
                () -> CodeCollecte.lire("FLEETPULSE|FP-XYZ|K7Q2MX", "FP-ABC"));
        assertTrue(autreColis.getMessage().contains("FP-XYZ"));
        assertThrows(IllegalArgumentException.class, () -> CodeCollecte.lire("FLEETPULSE|incomplet", "FP-ABC"));
        assertThrows(IllegalArgumentException.class, () -> CodeCollecte.lire("  ", "FP-ABC"));
    }

    @Test void comparaisonExacte() {
        assertTrue(CodeCollecte.correspond("K7Q2MX", "K7Q2MX"));
        assertFalse(CodeCollecte.correspond("K7Q2MX", "K7Q2MY"));
        assertFalse(CodeCollecte.correspond(null, "K7Q2MX"));
    }
}
