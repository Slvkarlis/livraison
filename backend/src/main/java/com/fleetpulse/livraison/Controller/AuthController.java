package com.fleetpulse.livraison.Controller;

import com.fleetpulse.livraison.Dto.CandidatureLivreurRequest;
import com.fleetpulse.livraison.Dto.CompteResponse;
import com.fleetpulse.livraison.Dto.DemandeCodeRequest;
import com.fleetpulse.livraison.Dto.DemandeReinitialisationRequest;
import com.fleetpulse.livraison.Dto.InscriptionPartenaireRequest;
import com.fleetpulse.livraison.Dto.InscriptionTelephoneRequest;
import com.fleetpulse.livraison.Dto.LoginRequest;
import com.fleetpulse.livraison.Dto.LoginResponse;
import com.fleetpulse.livraison.Dto.RefreshRequest;
import com.fleetpulse.livraison.Dto.ReinitialisationRequest;
import com.fleetpulse.livraison.Dto.SignupRequest;
import com.fleetpulse.livraison.Service.AuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.beans.factory.annotation.Value;
import com.fleetpulse.livraison.Config.ModeDemonstration;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// Erreurs d'authentification (401 / 403 compte inactif) traduites en JSON par GestionErreurs.
@RestController
@RequestMapping("/api/auth")
public class AuthController {
    @Autowired
    private AuthService authService;
    @Autowired
    private ModeDemonstration demonstration;
    @Value("${app.code.delai-renvoi-secondes:60}")
    private long delaiRenvoiSecondes;
    public record ConfigAuth(boolean demonstration, long delaiRenvoiSecondes) { }
    @GetMapping("/config")
    public ConfigAuth config() { return new ConfigAuth(demonstration.estActif(), delaiRenvoiSecondes); }

    // US-01 / US-102 : email ou telephone + mot de passe
    @PostMapping("/login")
    public LoginResponse login(@RequestBody LoginRequest request) {
        return authService.login(request);
    }

    // US-102
    @PostMapping("/refresh")
    public LoginResponse refresh(@RequestBody RefreshRequest request) {
        return authService.rafraichir(request);
    }

    // US-102
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@RequestBody(required = false) RefreshRequest request) {
        authService.deconnecter(request);
        return ResponseEntity.noContent().build();
    }

    // US-04
    @PostMapping("/signup")
    public ResponseEntity<Void> signup(@RequestBody SignupRequest request) {
        return ResponseEntity.status(authService.signup(request)).build();
    }

    // US-101 : etape 1, OTP envoye par SMS
    @PostMapping("/otp/demande")
    public ResponseEntity<Void> demanderCode(@RequestBody DemandeCodeRequest request) {
        authService.demanderCodeInscription(request);
        return ResponseEntity.accepted().build();
    }

    // US-101 : etape 2, creation du compte et connexion
    @PostMapping("/otp/inscription")
    public ResponseEntity<LoginResponse> inscrireParTelephone(@RequestBody InscriptionTelephoneRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.inscrireParTelephone(request));
    }

    // US-104
    @PostMapping("/inscription/partenaire")
    public ResponseEntity<CompteResponse> inscrirePartenaire(@RequestBody InscriptionPartenaireRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.inscrirePartenaire(request));
    }

    // US-106
    @PostMapping("/inscription/livreur")
    public ResponseEntity<CompteResponse> candidaterLivreur(@RequestBody CandidatureLivreurRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.candidaterLivreur(request));
    }

    // US-107 : toujours 202, que le compte existe ou non
    @PostMapping("/mot-de-passe/oubli")
    public ResponseEntity<Void> motDePasseOublie(@RequestBody DemandeReinitialisationRequest request) {
        authService.demanderReinitialisation(request);
        return ResponseEntity.accepted().build();
    }

    // US-107
    @PostMapping("/mot-de-passe/reinitialiser")
    public ResponseEntity<Void> reinitialiser(@RequestBody ReinitialisationRequest request) {
        authService.reinitialiserMotDePasse(request);
        return ResponseEntity.noContent().build();
    }
}
