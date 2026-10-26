package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Model.CodeVerification;
import com.fleetpulse.livraison.Model.enums.TypeCode;
import com.fleetpulse.livraison.Repository.CodeVerificationRepository;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Codes a 6 chiffres a usage unique, de duree limitee, avec un nombre d'essais limite (US-101, US-107). */
@Service
public class CodeVerificationService {
    private static final SecureRandom ALEATOIRE = new SecureRandom();

    @Autowired
    private CodeVerificationRepository repository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Value("${app.code.duree-minutes:10}")
    private long dureeMinutes;
    @Value("${app.code.tentatives-max:5}")
    private int tentativesMax;
    @Value("${app.code.delai-renvoi-secondes:60}")
    private long delaiRenvoiSecondes;

    /** Cree un nouveau code pour la cible et le renvoie en clair, pour l'envoyer par SMS ou email. */
    @Transactional
    public String generer(String cible, TypeCode type) {
        Instant maintenant = Instant.now();
        repository.findFirstByCibleAndTypeOrderByCreeLeDesc(cible, type)
                .filter(dernier -> dernier.getCreeLe().isAfter(maintenant.minusSeconds(delaiRenvoiSecondes)))
                .ifPresent(dernier -> {
                    throw new TropDeDemandesException("Patientez une minute avant de demander un nouveau code.");
                });
        String code = String.format("%06d", ALEATOIRE.nextInt(1_000_000));
        CodeVerification verification = new CodeVerification();
        verification.setCible(cible);
        verification.setType(type);
        verification.setCodeHash(passwordEncoder.encode(code));
        verification.setCreeLe(maintenant);
        verification.setExpireLe(maintenant.plus(Duration.ofMinutes(dureeMinutes)));
        repository.save(verification);
        return code;
    }

    /**
     * Verifie et consomme le dernier code envoye a la cible. Transaction separee : un essai rate reste compte
     * meme si l'appelant annule ensuite sa propre transaction.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean verifier(String cible, TypeCode type, String code) {
        Optional<CodeVerification> dernier = repository.findFirstByCibleAndTypeOrderByCreeLeDesc(cible, type);
        if (dernier.isEmpty() || code == null || code.isBlank()) return false;
        CodeVerification verification = dernier.get();
        if (verification.isUtilise() || verification.getExpireLe().isBefore(Instant.now())
                || verification.getTentatives() >= tentativesMax) {
            return false;
        }
        if (!passwordEncoder.matches(code.trim(), verification.getCodeHash())) {
            verification.setTentatives(verification.getTentatives() + 1);
            return false;
        }
        verification.setUtilise(true);
        return true;
    }

    /** Code redemande trop tot (429). */
    public static class TropDeDemandesException extends RuntimeException {
        public TropDeDemandesException(String message) {
            super(message);
        }
    }
}
