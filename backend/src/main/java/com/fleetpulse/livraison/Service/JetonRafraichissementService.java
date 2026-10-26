package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Model.JetonRafraichissement;
import com.fleetpulse.livraison.Model.Utilisateur;
import com.fleetpulse.livraison.Repository.JetonRafraichissementRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Jetons de rafraichissement (US-102) : seul leur hash SHA-256 est stocke. */
@Service
public class JetonRafraichissementService {
    private static final SecureRandom ALEATOIRE = new SecureRandom();

    @Autowired
    private JetonRafraichissementRepository repository;
    @Value("${app.jwt.refresh-expiration-ms}")
    private long dureeMs;

    public long dureeMs() {
        return dureeMs;
    }

    @Transactional
    public String emettre(Utilisateur utilisateur) {
        byte[] octets = new byte[32];
        ALEATOIRE.nextBytes(octets);
        String jeton = Base64.getUrlEncoder().withoutPadding().encodeToString(octets);
        JetonRafraichissement entite = new JetonRafraichissement();
        entite.setUtilisateur(utilisateur);
        entite.setJetonHash(hash(jeton));
        entite.setExpireLe(Instant.now().plusMillis(dureeMs));
        repository.save(entite);
        return jeton;
    }

    /**
     * Consomme le jeton (rotation) et renvoie son proprietaire. Un jeton deja utilise qui revient signale un vol
     * probable : toutes les sessions de l'utilisateur sont alors revoquees.
     */
    @Transactional(noRollbackFor = BadCredentialsException.class)
    public Utilisateur consommer(String jeton) {
        if (jeton == null || jeton.isBlank()) throw new BadCredentialsException("Jeton de rafraichissement manquant");
        JetonRafraichissement entite = repository.findByJetonHash(hash(jeton))
                .orElseThrow(() -> new BadCredentialsException("Jeton de rafraichissement invalide"));
        if (entite.isRevoque()) {
            repository.revoquerTous(entite.getUtilisateur());
            throw new BadCredentialsException("Jeton de rafraichissement deja utilise");
        }
        if (entite.getExpireLe().isBefore(Instant.now())) {
            throw new BadCredentialsException("Jeton de rafraichissement expire");
        }
        entite.setRevoque(true);
        return entite.getUtilisateur();
    }

    @Transactional
    public void revoquer(String jeton) {
        if (jeton == null || jeton.isBlank()) return;
        repository.findByJetonHash(hash(jeton)).ifPresent(entite -> entite.setRevoque(true));
    }

    @Transactional
    public void revoquerTous(Utilisateur utilisateur) {
        repository.revoquerTous(utilisateur);
    }

    static String hash(String jeton) {
        try {
            byte[] empreinte = MessageDigest.getInstance("SHA-256").digest(jeton.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(empreinte);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }
}
