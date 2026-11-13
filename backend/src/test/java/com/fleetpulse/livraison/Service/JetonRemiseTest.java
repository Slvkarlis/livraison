package com.fleetpulse.livraison.Service;

import static org.junit.jupiter.api.Assertions.*;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class JetonRemiseTest {
    static final String SECRET = "secret-de-test-assez-long-pour-hmac-256";
    static final Instant MAINTENANT = Instant.parse("2026-11-13T12:00:00Z");
    static final Instant EXPIRE = MAINTENANT.plusSeconds(JetonRemise.DUREE_SECONDES);

    static String erreur(String qr, String codeSuivi, String nonce, Instant quand) {
        return assertThrows(IllegalArgumentException.class, () -> JetonRemise.verifier(qr, codeSuivi, nonce, quand, SECRET)).getMessage();
    }

    @Test void qrValideAccepte() {
        String nonce = JetonRemise.nouveauNonce();
        String qr = JetonRemise.contenu("FP-ABC", nonce, EXPIRE, SECRET);
        assertTrue(JetonRemise.estUnQrDeRemise(qr));
        assertDoesNotThrow(() -> JetonRemise.verifier(qr, "FP-ABC", nonce, MAINTENANT, SECRET));
        assertDoesNotThrow(() -> JetonRemise.verifier(" " + qr + " ", "FP-ABC", nonce, EXPIRE, SECRET), "jusqu'a l'expiration incluse");
    }

    @Test void qrRefuses() {
        String nonce = JetonRemise.nouveauNonce();
        String qr = JetonRemise.contenu("FP-ABC", nonce, EXPIRE, SECRET);
        assertTrue(erreur(qr, "FP-ABC", nonce, EXPIRE.plusSeconds(1)).contains("expiré"));
        assertTrue(erreur(qr, "FP-AUTRE", nonce, MAINTENANT).contains("autre commande"));
        assertTrue(erreur(qr, "FP-ABC", JetonRemise.nouveauNonce(), MAINTENANT).contains("remplacé"));
        assertTrue(erreur(qr, "FP-ABC", null, MAINTENANT).contains("remplacé"));
        // Expiration prolongee a la main : la signature ne correspond plus
        String falsifie = qr.replace("|" + EXPIRE.getEpochSecond() + "|", "|" + EXPIRE.plusSeconds(3600).getEpochSecond() + "|");
        assertTrue(erreur(falsifie, "FP-ABC", nonce, MAINTENANT).contains("invalide"));
        assertTrue(erreur(JetonRemise.contenu("FP-ABC", nonce, EXPIRE, "un-autre-secret-de-trente-deux-caracteres"), "FP-ABC", nonce, MAINTENANT)
                .contains("invalide"));
        assertTrue(erreur("FLEETPULSE|FP-ABC|K7Q2MX", "FP-ABC", nonce, MAINTENANT).contains("non reconnu"), "étiquette du colis");
        assertFalse(JetonRemise.estUnQrDeRemise("123456"));
    }
}
