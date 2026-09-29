package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Model.Responsable;
import com.fleetpulse.livraison.Model.enums.Role;
import com.fleetpulse.livraison.Repository.UtilisateurRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Cree le compte administrateur au demarrage s'il n'existe pas (l'inscription publique ne cree que des clients). */
@Component
public class AdminInitializer implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(AdminInitializer.class);

    private final UtilisateurRepository utilisateurRepository;
    private final PasswordEncoder passwordEncoder;
    private final String email;
    private final String motDePasse;

    public AdminInitializer(UtilisateurRepository utilisateurRepository, PasswordEncoder passwordEncoder,
                            @Value("${app.admin.email}") String email,
                            @Value("${app.admin.mot-de-passe}") String motDePasse) {
        this.utilisateurRepository = utilisateurRepository;
        this.passwordEncoder = passwordEncoder;
        this.email = email.trim().toLowerCase();
        this.motDePasse = motDePasse;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (utilisateurRepository.existsByEmail(email)) return;
        Responsable admin = new Responsable();
        admin.setNom("Admin");
        admin.setPrenom("FleetPulse");
        admin.setEmail(email);
        admin.setMotDePasseHash(passwordEncoder.encode(motDePasse));
        admin.setRole(Role.RESPONSABLE);
        admin.setActif(true);
        utilisateurRepository.save(admin);
        log.info("Compte administrateur cree : {}", email);
    }
}
