package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.CandidatureLivreurRequest;
import com.fleetpulse.livraison.Dto.CompteResponse;
import com.fleetpulse.livraison.Dto.DemandeCodeRequest;
import com.fleetpulse.livraison.Dto.DemandeReinitialisationRequest;
import com.fleetpulse.livraison.Dto.InscriptionPartenaireRequest;
import com.fleetpulse.livraison.Dto.InscriptionTelephoneRequest;
import com.fleetpulse.livraison.Dto.LoginRequest;
import com.fleetpulse.livraison.Dto.LoginResponse;
import com.fleetpulse.livraison.Dto.ProfilResponse;
import com.fleetpulse.livraison.Dto.RefreshRequest;
import com.fleetpulse.livraison.Dto.ReinitialisationRequest;
import com.fleetpulse.livraison.Dto.SignupRequest;
import com.fleetpulse.livraison.Model.Client;
import com.fleetpulse.livraison.Model.Livreur;
import com.fleetpulse.livraison.Model.Partenaire;
import com.fleetpulse.livraison.Model.Utilisateur;
import com.fleetpulse.livraison.Model.enums.ActionAudit;
import com.fleetpulse.livraison.Model.enums.Role;
import com.fleetpulse.livraison.Model.enums.StatutCompte;
import com.fleetpulse.livraison.Model.enums.TypeCode;
import com.fleetpulse.livraison.Repository.UtilisateurRepository;
import com.fleetpulse.livraison.Security.JwtService;
import com.fleetpulse.livraison.Service.CodeVerificationService.TropDeDemandesException;
import com.fleetpulse.livraison.Service.CompteService.DonneeDejaUtiliseeException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
    private static final String CODE_INVALIDE = "Code invalide, expiré ou nombre d'essais dépassé. Demandez un nouveau code.";

    @Autowired
    private AuthenticationManager authenticationManager;
    @Autowired
    private JwtService jwtService;
    @Autowired
    private ProfilService profilService;
    @Autowired
    private UtilisateurRepository utilisateurRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private JetonRafraichissementService jetonService;
    @Autowired
    private CodeVerificationService codeService;
    @Autowired
    private CompteService compteService;
    @Autowired
    private AuditService auditService;
    @Autowired
    private NotificationSender notificationSender;
    @Value("${app.jwt.expiration-ms}")
    private long expirationMs;

    // US-102 : connexion par email ou telephone
    public LoginResponse login(LoginRequest request) {
        if (request == null || request.email() == null) throw new BadCredentialsException("Identifiants manquants");
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.email().trim(), request.motDePasse()));
        return ouvrirSession(authentication.getName());
    }

    // US-102 : nouveau jeton d'acces sans ressaisir le mot de passe (rotation du jeton de rafraichissement)
    public LoginResponse rafraichir(RefreshRequest request) {
        Utilisateur utilisateur = jetonService.consommer(request == null ? null : request.refreshToken());
        if (utilisateur.getStatut() == StatutCompte.SUSPENDU) {
            throw new DisabledException("Compte inactif");
        }
        return ouvrirSession(utilisateur.getEmail());
    }

    // US-102 : le jeton d'acces expire seul, le jeton de rafraichissement est revoque
    public void deconnecter(RefreshRequest request) {
        jetonService.revoquer(request == null ? null : request.refreshToken());
    }

    // US-04 : inscription client par email (conservee pour les applications existantes)
    @Transactional
    public HttpStatus signup(SignupRequest request) {
        String email = request == null || request.email() == null ? "" : request.email().trim().toLowerCase();
        if (email.isBlank() || request.nom() == null || request.nom().isBlank()
                || request.prenom() == null || request.prenom().isBlank()
                || request.motDePasse() == null || request.motDePasse().length() < 8) {
            return HttpStatus.BAD_REQUEST;
        }
        String telephone = Telephones.normaliser(request.telephone());
        if (telephone != null && !Telephones.estValide(telephone)) return HttpStatus.BAD_REQUEST;
        if (utilisateurRepository.existsByEmail(email)) return HttpStatus.CONFLICT;
        if (telephone != null && utilisateurRepository.existsByTelephone(telephone)) return HttpStatus.CONFLICT;

        // Les livreurs et partenaires passent par un dossier valide par le Responsable.
        Client utilisateur = new Client();
        compteService.remplirIdentite(utilisateur, request.nom(), request.prenom(), email, telephone,
                request.motDePasse());
        utilisateur.setRole(Role.CLIENT);
        utilisateur.setStatut(StatutCompte.ACTIF);
        try {
            utilisateurRepository.saveAndFlush(utilisateur);
        } catch (DataIntegrityViolationException exception) {
            return HttpStatus.CONFLICT;
        }
        auditService.enregistrer(ActionAudit.INSCRIPTION_CLIENT, utilisateur, "Inscription par email");
        return HttpStatus.CREATED;
    }

    // US-101 : etape 1, envoi de l'OTP par SMS
    public void demanderCodeInscription(DemandeCodeRequest request) {
        String telephone = Telephones.normaliser(request == null ? null : request.telephone());
        if (!Telephones.estValide(telephone)) throw new IllegalArgumentException("Numéro de téléphone invalide.");
        if (utilisateurRepository.existsByTelephone(telephone)) {
            throw new DonneeDejaUtiliseeException("Ce numéro est déjà associé à un compte.");
        }
        notificationSender.verifierDisponible();
        String code = codeService.generer(telephone, TypeCode.INSCRIPTION);
        notificationSender.envoyerSms(telephone, "Votre code FleetPulse : " + code + " (valable 10 minutes).");
    }

    // US-101 : etape 2, creation du compte client avec l'OTP recu ; l'utilisateur est connecte directement
    @Transactional
    public LoginResponse inscrireParTelephone(InscriptionTelephoneRequest request) {
        if (request == null) throw new IllegalArgumentException("Requête vide.");
        String telephone = Telephones.normaliser(request.telephone());
        if (!Telephones.estValide(telephone)) throw new IllegalArgumentException("Numéro de téléphone invalide.");
        String email = compteService.verifierIdentite(request.nom(), request.prenom(), request.email(),
                request.motDePasse());
        compteService.verifierDisponibilite(email, telephone);
        if (!codeService.verifier(telephone, TypeCode.INSCRIPTION, request.code())) {
            throw new IllegalArgumentException(CODE_INVALIDE);
        }
        Client client = new Client();
        compteService.remplirIdentite(client, request.nom(), request.prenom(), email, telephone, request.motDePasse());
        client.setTelephoneVerifie(true);
        client.setRole(Role.CLIENT);
        client.setStatut(StatutCompte.ACTIF);
        utilisateurRepository.save(client);
        auditService.enregistrer(ActionAudit.INSCRIPTION_CLIENT, client, "Inscription par OTP");
        return ouvrirSession(email);
    }

    // US-104 : dossier d'un commercant, en attente de validation
    @Transactional
    public CompteResponse inscrirePartenaire(InscriptionPartenaireRequest request) {
        if (request == null) throw new IllegalArgumentException("Requête vide.");
        String email = compteService.verifierIdentite(request.nom(), request.prenom(), request.email(),
                request.motDePasse());
        String telephone = Telephones.normaliser(request.telephone());
        Partenaire partenaire = new Partenaire();
        compteService.remplirIdentite(partenaire, request.nom(), request.prenom(), email, telephone,
                request.motDePasse());
        partenaire.setNomCommerce(CompteService.texte(request.nomCommerce()));
        partenaire.setCategorie(CompteService.texte(request.categorie()));
        partenaire.setAdresse(CompteService.texte(request.adresse()));
        partenaire.setLatitude(request.latitude());
        partenaire.setLongitude(request.longitude());
        partenaire.setMatriculeFiscal(CompteService.texte(request.matriculeFiscal()));
        partenaire.setRole(Role.PARTENAIRE);
        partenaire.setStatut(StatutCompte.EN_ATTENTE);
        compteService.verifierDossier(partenaire);
        compteService.verifierDisponibilite(email, telephone);
        utilisateurRepository.save(partenaire);
        auditService.enregistrer(ActionAudit.INSCRIPTION_PARTENAIRE, partenaire, partenaire.getNomCommerce());
        return CompteResponse.from(partenaire);
    }

    // US-106 : candidature d'un livreur, en attente de validation
    @Transactional
    public CompteResponse candidaterLivreur(CandidatureLivreurRequest request) {
        if (request == null) throw new IllegalArgumentException("Requête vide.");
        String email = compteService.verifierIdentite(request.nom(), request.prenom(), request.email(),
                request.motDePasse());
        String telephone = Telephones.normaliser(request.telephone());
        Livreur livreur = new Livreur();
        compteService.remplirIdentite(livreur, request.nom(), request.prenom(), email, telephone,
                request.motDePasse());
        livreur.setNumeroIdentite(CompteService.texte(request.numeroIdentite()));
        livreur.setVehiculeDeclare(CompteService.texte(request.vehiculeDeclare()));
        livreur.setRole(Role.LIVREUR);
        livreur.setStatut(StatutCompte.EN_ATTENTE);
        compteService.verifierDossier(livreur);
        compteService.verifierDisponibilite(email, telephone);
        utilisateurRepository.save(livreur);
        auditService.enregistrer(ActionAudit.CANDIDATURE_LIVREUR, livreur, livreur.getVehiculeDeclare());
        return CompteResponse.from(livreur);
    }

    // US-107 : envoi d'un code ; meme reponse que le compte existe ou non
    public void demanderReinitialisation(DemandeReinitialisationRequest request) {
        notificationSender.verifierDisponible();
        utilisateurRepository.findByIdentifiant(request == null ? null : request.identifiant())
                .filter(utilisateur -> utilisateur.getStatut() != StatutCompte.REFUSE)
                .ifPresent(this::envoyerCodeReinitialisation);
    }

    // US-107 : nouveau mot de passe ; toutes les sessions ouvertes sont fermees
    @Transactional
    public void reinitialiserMotDePasse(ReinitialisationRequest request) {
        if (request == null || request.nouveauMotDePasse() == null || request.nouveauMotDePasse().length() < 8) {
            throw new IllegalArgumentException("Le mot de passe doit contenir au moins 8 caractères.");
        }
        Utilisateur utilisateur = utilisateurRepository.findByIdentifiant(request.identifiant())
                .orElseThrow(() -> new IllegalArgumentException(CODE_INVALIDE));
        if (!codeService.verifier(utilisateur.getEmail(), TypeCode.REINITIALISATION, request.code())) {
            throw new IllegalArgumentException(CODE_INVALIDE);
        }
        utilisateur.setMotDePasseHash(passwordEncoder.encode(request.nouveauMotDePasse()));
        jetonService.revoquerTous(utilisateur);
        auditService.enregistrer(ActionAudit.MOT_DE_PASSE_REINITIALISE, utilisateur, null);
    }

    private void envoyerCodeReinitialisation(Utilisateur utilisateur) {
        String code;
        try {
            code = codeService.generer(utilisateur.getEmail(), TypeCode.REINITIALISATION);
        } catch (TropDeDemandesException exception) {
            return;   // un code recent est toujours valable ; ne pas reveler l'existence du compte
        }
        String message = "Votre code de réinitialisation FleetPulse : " + code + " (valable 10 minutes).";
        notificationSender.envoyerEmail(utilisateur.getEmail(), "Réinitialisation du mot de passe", message);
        if (utilisateur.getTelephone() != null) notificationSender.envoyerSms(utilisateur.getTelephone(), message);
    }

    private LoginResponse ouvrirSession(String email) {
        Utilisateur utilisateur = utilisateurRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("Utilisateur introuvable"));
        ProfilResponse profil = profilService.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("Utilisateur introuvable"));
        String jetonRafraichissement = jetonService.emettre(utilisateur);
        return new LoginResponse(jwtService.generateToken(email, profil.role().name(), profil), "Bearer",
                expirationMs, jetonRafraichissement, jetonService.dureeMs());
    }
}
