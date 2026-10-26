package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.CompteResponse;
import com.fleetpulse.livraison.Dto.CreateResponsableRequest;
import com.fleetpulse.livraison.Dto.DossierRequest;
import com.fleetpulse.livraison.Model.Livreur;
import com.fleetpulse.livraison.Model.Partenaire;
import com.fleetpulse.livraison.Model.Responsable;
import com.fleetpulse.livraison.Model.Utilisateur;
import com.fleetpulse.livraison.Model.enums.ActionAudit;
import com.fleetpulse.livraison.Model.enums.Role;
import com.fleetpulse.livraison.Model.enums.StatutCompte;
import com.fleetpulse.livraison.Repository.UtilisateurRepository;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Cycle de vie des comptes : decisions du Responsable sur les dossiers (US-105, US-106), suspension et
 * reactivation avec motif (US-109), comptes Responsable par sous-role (US-103), correction d'un dossier par
 * son auteur. Chaque changement est trace dans le journal d'audit (US-108).
 */
@Service
public class CompteService {
    private static final Set<StatutCompte> DOSSIER_OUVERT =
            EnumSet.of(StatutCompte.EN_ATTENTE, StatutCompte.COMPLEMENT_DEMANDE);

    @Autowired
    private UtilisateurRepository utilisateurRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private JetonRafraichissementService jetonService;
    @Autowired
    private AuditService auditService;
    @Autowired
    private NotificationSender notificationSender;

    @Transactional(readOnly = true)
    public List<CompteResponse> lister(Role role, StatutCompte statut) {
        return utilisateurRepository.findAllByOrderByNomAscPrenomAsc().stream()
                .filter(utilisateur -> role == null || utilisateur.getRole() == role)
                .filter(utilisateur -> statut == null || utilisateur.getStatut() == statut)
                .map(CompteResponse::from).toList();
    }

    /** Dossiers partenaires et livreurs en attente de decision, du plus ancien au plus recent. */
    @Transactional(readOnly = true)
    public List<CompteResponse> dossiersOuverts() {
        return utilisateurRepository.findAllByStatutInOrderByDateCreationAsc(DOSSIER_OUVERT).stream()
                .map(CompteResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public CompteResponse detail(Long id) {
        return CompteResponse.from(trouver(id));
    }

    @Transactional
    public CompteResponse valider(Long id) {
        Utilisateur utilisateur = trouver(id);
        exigerStatut(utilisateur, DOSSIER_OUVERT, "Seul un dossier en attente peut être validé.");
        changerStatut(utilisateur, StatutCompte.ACTIF, null);
        auditService.enregistrer(ActionAudit.COMPTE_VALIDE, utilisateur, null);
        notificationSender.envoyerEmail(utilisateur.getEmail(), "Compte validé",
                "Votre compte FleetPulse est validé, vous pouvez maintenant l'utiliser.");
        return CompteResponse.from(utilisateur);
    }

    @Transactional
    public CompteResponse refuser(Long id, String motif) {
        Utilisateur utilisateur = trouver(id);
        String motifValide = motifObligatoire(motif);
        exigerStatut(utilisateur, DOSSIER_OUVERT, "Seul un dossier en attente peut être refusé.");
        changerStatut(utilisateur, StatutCompte.REFUSE, motifValide);
        jetonService.revoquerTous(utilisateur);
        auditService.enregistrer(ActionAudit.COMPTE_REFUSE, utilisateur, motifValide);
        notificationSender.envoyerEmail(utilisateur.getEmail(), "Dossier refusé",
                "Votre dossier FleetPulse a été refusé : " + motifValide);
        return CompteResponse.from(utilisateur);
    }

    @Transactional
    public CompteResponse demanderComplement(Long id, String motif) {
        Utilisateur utilisateur = trouver(id);
        String motifValide = motifObligatoire(motif);
        exigerStatut(utilisateur, EnumSet.of(StatutCompte.EN_ATTENTE),
                "Un complément ne peut être demandé que sur un dossier en attente.");
        changerStatut(utilisateur, StatutCompte.COMPLEMENT_DEMANDE, motifValide);
        auditService.enregistrer(ActionAudit.COMPLEMENT_DEMANDE, utilisateur, motifValide);
        notificationSender.envoyerEmail(utilisateur.getEmail(), "Complément demandé",
                "Votre dossier FleetPulse doit être complété : " + motifValide);
        return CompteResponse.from(utilisateur);
    }

    @Transactional
    public CompteResponse suspendre(Long id, String motif, Authentication auteur) {
        Utilisateur utilisateur = trouver(id);
        String motifValide = motifObligatoire(motif);
        if (utilisateur.getEmail().equals(auteur.getName())) {
            throw new TransitionInvalideException("Vous ne pouvez pas suspendre votre propre compte.");
        }
        exigerAdminPourResponsable(utilisateur, auteur);
        exigerStatut(utilisateur, EnumSet.of(StatutCompte.ACTIF), "Seul un compte actif peut être suspendu.");
        changerStatut(utilisateur, StatutCompte.SUSPENDU, motifValide);
        jetonService.revoquerTous(utilisateur);
        auditService.enregistrer(ActionAudit.COMPTE_SUSPENDU, utilisateur, motifValide);
        notificationSender.envoyerEmail(utilisateur.getEmail(), "Compte suspendu",
                "Votre compte FleetPulse est suspendu : " + motifValide);
        return CompteResponse.from(utilisateur);
    }

    @Transactional
    public CompteResponse reactiver(Long id, String motif, Authentication auteur) {
        Utilisateur utilisateur = trouver(id);
        String motifValide = motifObligatoire(motif);
        exigerAdminPourResponsable(utilisateur, auteur);
        exigerStatut(utilisateur, EnumSet.of(StatutCompte.SUSPENDU), "Seul un compte suspendu peut être réactivé.");
        changerStatut(utilisateur, StatutCompte.ACTIF, null);
        auditService.enregistrer(ActionAudit.COMPTE_REACTIVE, utilisateur, motifValide);
        notificationSender.envoyerEmail(utilisateur.getEmail(), "Compte réactivé",
                "Votre compte FleetPulse est de nouveau actif.");
        return CompteResponse.from(utilisateur);
    }

    @Transactional
    public CompteResponse creerResponsable(CreateResponsableRequest request) {
        if (request == null) throw new IllegalArgumentException("Requête vide.");
        if (request.sousRole() == null) throw new IllegalArgumentException("Choisissez le sous-rôle : OPERATIONS ou FINANCE.");
        String email = verifierIdentite(request.nom(), request.prenom(), request.email(), request.motDePasse());
        String telephone = Telephones.normaliser(request.telephone());
        if (telephone != null && !Telephones.estValide(telephone)) {
            throw new IllegalArgumentException("Numéro de téléphone invalide.");
        }
        verifierDisponibilite(email, telephone);
        Responsable responsable = new Responsable();
        remplirIdentite(responsable, request.nom(), request.prenom(), email, telephone, request.motDePasse());
        responsable.setRole(Role.RESPONSABLE);
        responsable.setSousRole(request.sousRole());
        responsable.setStatut(StatutCompte.ACTIF);
        utilisateurRepository.save(responsable);
        auditService.enregistrer(ActionAudit.RESPONSABLE_CREE, responsable, "Sous-rôle " + request.sousRole());
        return CompteResponse.from(responsable);
    }

    @Transactional(readOnly = true)
    public CompteResponse monDossier(String email) {
        return CompteResponse.from(utilisateurRepository.findByEmail(email).orElseThrow(CompteIntrouvableException::new));
    }

    /** Le candidat corrige son dossier ; il repasse en attente de decision. */
    @Transactional
    public CompteResponse corrigerDossier(String email, DossierRequest request) {
        Utilisateur utilisateur = utilisateurRepository.findByEmail(email).orElseThrow(CompteIntrouvableException::new);
        if (request == null) throw new IllegalArgumentException("Requête vide.");
        exigerStatut(utilisateur, DOSSIER_OUVERT, "Votre dossier n'est plus modifiable.");
        if (texte(request.nom()) != null) utilisateur.setNom(texte(request.nom()));
        if (texte(request.prenom()) != null) utilisateur.setPrenom(texte(request.prenom()));
        String telephone = Telephones.normaliser(request.telephone());
        if (telephone != null && !telephone.equals(utilisateur.getTelephone())) {
            if (utilisateurRepository.existsByTelephone(telephone)) {
                throw new DonneeDejaUtiliseeException("Ce numéro est déjà associé à un compte.");
            }
            utilisateur.setTelephone(telephone);
            utilisateur.setTelephoneVerifie(false);
        }
        if (utilisateur instanceof Partenaire partenaire) {
            if (texte(request.nomCommerce()) != null) partenaire.setNomCommerce(texte(request.nomCommerce()));
            if (texte(request.categorie()) != null) partenaire.setCategorie(texte(request.categorie()));
            if (texte(request.adresse()) != null) partenaire.setAdresse(texte(request.adresse()));
            if (request.latitude() != null) partenaire.setLatitude(request.latitude());
            if (request.longitude() != null) partenaire.setLongitude(request.longitude());
            if (texte(request.matriculeFiscal()) != null) partenaire.setMatriculeFiscal(texte(request.matriculeFiscal()));
        } else if (utilisateur instanceof Livreur livreur) {
            if (texte(request.numeroIdentite()) != null) livreur.setNumeroIdentite(texte(request.numeroIdentite()));
            if (texte(request.vehiculeDeclare()) != null) livreur.setVehiculeDeclare(texte(request.vehiculeDeclare()));
        }
        verifierDossier(utilisateur);
        changerStatut(utilisateur, StatutCompte.EN_ATTENTE, null);
        auditService.enregistrer(ActionAudit.DOSSIER_RESOUMIS, utilisateur, null);
        return CompteResponse.from(utilisateur);
    }

    /** Controle commun a toutes les creations de compte ; renvoie l'email normalise. */
    public String verifierIdentite(String nom, String prenom, String email, String motDePasse) {
        String emailNormalise = email == null ? "" : email.trim().toLowerCase();
        if (emailNormalise.isBlank() || !emailNormalise.contains("@") || texte(nom) == null || texte(prenom) == null) {
            throw new IllegalArgumentException("Indiquez votre nom, votre prénom et une adresse email valide.");
        }
        if (motDePasse == null || motDePasse.length() < 8) {
            throw new IllegalArgumentException("Le mot de passe doit contenir au moins 8 caractères.");
        }
        return emailNormalise;
    }

    public void verifierDisponibilite(String email, String telephone) {
        if (utilisateurRepository.existsByEmail(email)) {
            throw new DonneeDejaUtiliseeException("Cette adresse email est déjà associée à un compte.");
        }
        if (telephone != null && utilisateurRepository.existsByTelephone(telephone)) {
            throw new DonneeDejaUtiliseeException("Ce numéro est déjà associé à un compte.");
        }
    }

    /** Pieces obligatoires d'un dossier partenaire (US-104) ou livreur (US-106). */
    public void verifierDossier(Utilisateur utilisateur) {
        if (!Telephones.estValide(utilisateur.getTelephone())) {
            throw new IllegalArgumentException("Numéro de téléphone invalide.");
        }
        if (utilisateur instanceof Partenaire partenaire) {
            if (texte(partenaire.getNomCommerce()) == null || texte(partenaire.getCategorie()) == null
                    || texte(partenaire.getAdresse()) == null || texte(partenaire.getMatriculeFiscal()) == null) {
                throw new IllegalArgumentException(
                        "Indiquez le nom du commerce, sa catégorie, son adresse et son matricule fiscal.");
            }
            if (!coordonneesValides(partenaire.getLatitude(), partenaire.getLongitude())) {
                throw new IllegalArgumentException("Position du commerce invalide.");
            }
        } else if (utilisateur instanceof Livreur livreur) {
            if (texte(livreur.getNumeroIdentite()) == null || texte(livreur.getVehiculeDeclare()) == null) {
                throw new IllegalArgumentException("Indiquez votre numéro d'identité et votre véhicule.");
            }
        }
    }

    public void remplirIdentite(Utilisateur utilisateur, String nom, String prenom, String email, String telephone,
                                String motDePasse) {
        utilisateur.setNom(texte(nom));
        utilisateur.setPrenom(texte(prenom));
        utilisateur.setEmail(email);
        utilisateur.setTelephone(telephone);
        utilisateur.setMotDePasseHash(passwordEncoder.encode(motDePasse));
    }

    /** Chaine nettoyee, ou null si vide. */
    public static String texte(String valeur) {
        return valeur == null || valeur.isBlank() ? null : valeur.trim();
    }

    private Utilisateur trouver(Long id) {
        return utilisateurRepository.findById(id).orElseThrow(CompteIntrouvableException::new);
    }

    private void changerStatut(Utilisateur utilisateur, StatutCompte statut, String motif) {
        utilisateur.setStatut(statut);
        utilisateur.setMotifStatut(motif);
    }

    private void exigerStatut(Utilisateur utilisateur, Set<StatutCompte> autorises, String message) {
        if (!autorises.contains(utilisateur.getStatut())) throw new TransitionInvalideException(message);
    }

    private void exigerAdminPourResponsable(Utilisateur cible, Authentication auteur) {
        boolean admin = auteur.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        if (cible instanceof Responsable && !admin) {
            throw new AccessDeniedException("Seul l'administrateur principal peut modifier un compte Responsable.");
        }
    }

    private String motifObligatoire(String motif) {
        String valeur = texte(motif);
        if (valeur == null) throw new IllegalArgumentException("Le motif est obligatoire.");
        if (valeur.length() > 500) throw new IllegalArgumentException("Motif trop long (500 caractères maximum).");
        return valeur;
    }

    private boolean coordonneesValides(Double latitude, Double longitude) {
        return latitude != null && longitude != null
                && Double.isFinite(latitude) && Double.isFinite(longitude)
                && latitude >= -90 && latitude <= 90
                && longitude >= -180 && longitude <= 180;
    }

    /** Compte inexistant (404). */
    public static class CompteIntrouvableException extends RuntimeException {
    }

    /** Changement de statut impossible depuis le statut actuel (409). */
    public static class TransitionInvalideException extends RuntimeException {
        public TransitionInvalideException(String message) {
            super(message);
        }
    }

    /** Email ou telephone deja utilise par un autre compte (409). */
    public static class DonneeDejaUtiliseeException extends RuntimeException {
        public DonneeDejaUtiliseeException(String message) {
            super(message);
        }
    }
}
