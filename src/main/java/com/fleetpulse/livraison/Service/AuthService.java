package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.LoginRequest;
import com.fleetpulse.livraison.Dto.LoginResponse;
import com.fleetpulse.livraison.Dto.SignupRequest;
import com.fleetpulse.livraison.Model.Client;
import com.fleetpulse.livraison.Model.enums.Role;
import com.fleetpulse.livraison.Repository.UtilisateurRepository;
import com.fleetpulse.livraison.Security.JwtService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final UtilisateurRepository utilisateurRepository;
    private final PasswordEncoder passwordEncoder;
    private final long expirationMs;

    public AuthService(AuthenticationManager authenticationManager, JwtService jwtService,
                       UtilisateurRepository utilisateurRepository, PasswordEncoder passwordEncoder,
                       @Value("${app.jwt.expiration-ms}") long expirationMs) {
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.utilisateurRepository = utilisateurRepository;
        this.passwordEncoder = passwordEncoder;
        this.expirationMs = expirationMs;
    }

    public LoginResponse login(LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.email(), request.motDePasse()));
        String role = authentication.getAuthorities().stream().findFirst()
                .map(authority -> authority.getAuthority().replaceFirst("^ROLE_", ""))
                .orElse("USER");
        return new LoginResponse(jwtService.generateToken(authentication.getName(), role), "Bearer", expirationMs);
    }

    @Transactional
    public HttpStatus signup(SignupRequest request) {
        String email = request == null || request.email() == null ? "" : request.email().trim().toLowerCase();
        if (email.isBlank() || request.nom() == null || request.nom().isBlank()
                || request.prenom() == null || request.prenom().isBlank()
                || request.motDePasse() == null || request.motDePasse().length() < 8) {
            return HttpStatus.BAD_REQUEST;
        }
        if (utilisateurRepository.existsByEmail(email)) return HttpStatus.CONFLICT;

        // Les livreurs sont crees par l'administrateur, jamais par inscription publique.
        Client utilisateur = new Client();
        utilisateur.setNom(request.nom().trim());
        utilisateur.setPrenom(request.prenom().trim());
        utilisateur.setEmail(email);
        utilisateur.setTelephone(request.telephone());
        utilisateur.setMotDePasseHash(passwordEncoder.encode(request.motDePasse()));
        utilisateur.setRole(Role.CLIENT);
        utilisateur.setActif(true);
        try {
            utilisateurRepository.save(utilisateur);
            return HttpStatus.CREATED;
        } catch (DataIntegrityViolationException exception) {
            return HttpStatus.CONFLICT;
        }
    }
}
