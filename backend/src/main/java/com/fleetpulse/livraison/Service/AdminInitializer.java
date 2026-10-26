package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Model.Responsable;
import com.fleetpulse.livraison.Model.enums.Role;
import com.fleetpulse.livraison.Model.enums.StatutCompte;
import com.fleetpulse.livraison.Repository.UtilisateurRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Cree le compte administrateur au demarrage s'il n'existe pas (l'inscription publique ne cree que des clients). */
@Component
@Order(1)   // apres MigrationComptes
public class AdminInitializer implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(AdminInitializer.class);

    @Autowired
    private UtilisateurRepository utilisateurRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Value("${app.admin.email}")
    private String emailConfigure;
    @Value("${app.admin.mot-de-passe}")
    private String motDePasse;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        String email = emailConfigure.trim().toLowerCase();
        if (utilisateurRepository.existsByEmail(email)) return;
        Responsable admin = new Responsable();
        admin.setNom("Admin");
        admin.setPrenom("FleetPulse");
        admin.setEmail(email);
        admin.setMotDePasseHash(passwordEncoder.encode(motDePasse));
        admin.setRole(Role.RESPONSABLE);
        admin.setStatut(StatutCompte.ACTIF);   // sans sous-role : administrateur principal
        utilisateurRepository.save(admin);
        log.info("Compte administrateur cree : {}", email);
    }
}
