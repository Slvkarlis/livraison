package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.AssignVehiculeRequest;
import com.fleetpulse.livraison.Dto.CreateLivreurRequest;
import com.fleetpulse.livraison.Dto.CreateVehiculeRequest;
import com.fleetpulse.livraison.Dto.LivreurResponse;
import com.fleetpulse.livraison.Dto.VehiculeResponse;
import com.fleetpulse.livraison.Model.Livreur;
import com.fleetpulse.livraison.Model.Vehicule;
import com.fleetpulse.livraison.Model.enums.ActionAudit;
import com.fleetpulse.livraison.Model.enums.Role;
import com.fleetpulse.livraison.Model.enums.StatutCompte;
import com.fleetpulse.livraison.Repository.LivreurRepository;
import com.fleetpulse.livraison.Repository.UtilisateurRepository;
import com.fleetpulse.livraison.Repository.VehiculeRepository;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminService {
    // Les candidats (EN_ATTENTE, COMPLEMENT_DEMANDE, REFUSE) sont geres par CompteService, pas par la flotte.
    private static final Set<StatutCompte> FLOTTE = EnumSet.of(StatutCompte.ACTIF, StatutCompte.SUSPENDU);

    @Autowired
    private LivreurRepository livreurRepository;
    @Autowired
    private VehiculeRepository vehiculeRepository;
    @Autowired
    private UtilisateurRepository utilisateurRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private JetonRafraichissementService jetonService;
    @Autowired
    private AuditService auditService;

    @Transactional(readOnly = true)
    public List<LivreurResponse> listLivreurs() {
        return livreurRepository.findAllByStatutInOrderByNomAscPrenomAsc(FLOTTE).stream().map(LivreurResponse::from).toList();
    }

    @Transactional
    public LivreurResponse createLivreur(CreateLivreurRequest request) {
        validateLivreur(request);
        if (utilisateurRepository.existsByEmail(request.email().trim().toLowerCase())) {
            throw new DuplicateDataException();
        }
        Livreur livreur = new Livreur();
        livreur.setNom(request.nom().trim());
        livreur.setPrenom(request.prenom().trim());
        livreur.setEmail(request.email().trim().toLowerCase());
        livreur.setTelephone(request.telephone());
        livreur.setMotDePasseHash(passwordEncoder.encode(request.motDePasse()));
        livreur.setRole(Role.LIVREUR);
        livreur.setStatut(StatutCompte.ACTIF);
        try {
            livreurRepository.saveAndFlush(livreur);
        } catch (DataIntegrityViolationException exception) {
            throw new DuplicateDataException();
        }
        auditService.enregistrer(ActionAudit.LIVREUR_CREE, livreur, null);
        return LivreurResponse.from(livreur);
    }

    @Transactional
    public Optional<LivreurResponse> updateLivreur(Long id, CreateLivreurRequest request) {
        return livreurRepository.findById(id).map(livreur -> {
            if (request.nom() != null && !request.nom().isBlank()) livreur.setNom(request.nom().trim());
            if (request.prenom() != null && !request.prenom().isBlank()) livreur.setPrenom(request.prenom().trim());
            if (request.telephone() != null) livreur.setTelephone(request.telephone());
            if (request.motDePasse() != null && !request.motDePasse().isBlank()) {
                livreur.setMotDePasseHash(passwordEncoder.encode(request.motDePasse()));
            }
            auditService.enregistrer(ActionAudit.LIVREUR_MODIFIE, livreur, null);
            return LivreurResponse.from(livreurRepository.save(livreur));
        });
    }

    @Transactional
    public boolean deactivateLivreur(Long id) {
        return setLivreurActif(id, false);
    }

    @Transactional
    public boolean activateLivreur(Long id) {
        return setLivreurActif(id, true);
    }

    // Raccourci de la page Livreurs ; la suspension avec motif saisi passe par CompteService (US-109).
    private boolean setLivreurActif(Long id, boolean actif) {
        return livreurRepository.findById(id).filter(livreur -> FLOTTE.contains(livreur.getStatut())).map(livreur -> {
            if (livreur.isActif() != actif) {
                livreur.setStatut(actif ? StatutCompte.ACTIF : StatutCompte.SUSPENDU);
                livreur.setMotifStatut(actif ? null : "Désactivé depuis la liste des livreurs");
                if (!actif) jetonService.revoquerTous(livreur);
                auditService.enregistrer(actif ? ActionAudit.COMPTE_REACTIVE : ActionAudit.COMPTE_SUSPENDU,
                        livreur, livreur.getMotifStatut());
            }
            livreurRepository.save(livreur);
            return true;
        }).orElse(false);
    }

    @Transactional(readOnly = true)
    public List<VehiculeResponse> listVehicules() {
        return vehiculeRepository.findAllByOrderByImmatriculationAsc().stream().map(VehiculeResponse::from).toList();
    }

    @Transactional
    public VehiculeResponse createVehicule(CreateVehiculeRequest request) {
        if (request == null || request.immatriculation() == null || request.immatriculation().isBlank()) {
            throw new IllegalArgumentException("Immatriculation obligatoire");
        }
        Vehicule vehicule = new Vehicule();
        vehicule.setImmatriculation(request.immatriculation().trim().toUpperCase());
        vehicule.setType(request.type());
        vehicule.setCapaciteKg(request.capaciteKg());
        if (request.consommationLitres100Km() != null) {
            validateConsumption(request.consommationLitres100Km());
            vehicule.setConsommationLitres100Km(request.consommationLitres100Km());
        }
        try {
            vehiculeRepository.saveAndFlush(vehicule);
        } catch (DataIntegrityViolationException exception) {
            throw new DuplicateDataException();
        }
        auditService.enregistrer(ActionAudit.VEHICULE_CREE, "VEHICULE", vehicule.getId(), vehicule.getImmatriculation());
        return VehiculeResponse.from(vehicule);
    }

    @Transactional
    public Optional<VehiculeResponse> updateVehicule(Long id, CreateVehiculeRequest request) {
        return vehiculeRepository.findById(id).map(vehicule -> {
            if (request.immatriculation() != null && !request.immatriculation().isBlank()) {
                vehicule.setImmatriculation(request.immatriculation().trim().toUpperCase());
            }
            if (request.type() != null) vehicule.setType(request.type());
            if (request.capaciteKg() != null) vehicule.setCapaciteKg(request.capaciteKg());
            if (request.consommationLitres100Km() != null) {
                validateConsumption(request.consommationLitres100Km());
                vehicule.setConsommationLitres100Km(request.consommationLitres100Km());
            }
            auditService.enregistrer(ActionAudit.VEHICULE_MODIFIE, "VEHICULE", vehicule.getId(),
                    vehicule.getImmatriculation());
            return VehiculeResponse.from(vehiculeRepository.save(vehicule));
        });
    }

    @Transactional
    public boolean deactivateVehicule(Long id) {
        return setVehiculeActif(id, false);
    }

    @Transactional
    public boolean activateVehicule(Long id) {
        return setVehiculeActif(id, true);
    }

    private boolean setVehiculeActif(Long id, boolean actif) {
        return vehiculeRepository.findById(id).map(vehicule -> {
            vehicule.setActif(actif);
            vehiculeRepository.save(vehicule);
            auditService.enregistrer(actif ? ActionAudit.VEHICULE_ACTIVE : ActionAudit.VEHICULE_DESACTIVE,
                    "VEHICULE", vehicule.getId(), vehicule.getImmatriculation());
            return true;
        }).orElse(false);
    }

    @Transactional
    public Optional<LivreurResponse> assignVehicule(Long livreurId, AssignVehiculeRequest request) {
        if (request == null || request.vehiculeId() == null) throw new IllegalArgumentException("Vehicule obligatoire");
        Optional<Livreur> livreur = livreurRepository.findById(livreurId);
        Optional<Vehicule> vehicule = vehiculeRepository.findById(request.vehiculeId());
        if (livreur.isEmpty() || vehicule.isEmpty() || !vehicule.get().isActif()) return Optional.empty();
        if (vehicule.get().getLivreur() != null && !vehicule.get().getLivreur().getId().equals(livreurId)) {
            // Liberer la voiture avant de la reaffecter (colonne vehicule_id unique).
            livreurRepository.saveAndFlush(unassign(vehicule.get().getLivreur()));
        }
        livreur.get().setVehicule(vehicule.get());
        vehiculeRepository.save(vehicule.get());
        auditService.enregistrer(ActionAudit.VEHICULE_AFFECTE, livreur.get(), vehicule.get().getImmatriculation());
        return Optional.of(LivreurResponse.from(livreurRepository.save(livreur.get())));
    }

    @Transactional
    public boolean unassignVehicule(Long livreurId) {
        return livreurRepository.findById(livreurId).map(livreur -> {
            livreur.setVehicule(null);
            livreurRepository.save(livreur);
            auditService.enregistrer(ActionAudit.VEHICULE_RETIRE, livreur, null);
            return true;
        }).orElse(false);
    }

    private Livreur unassign(Livreur livreur) {
        livreur.setVehicule(null);
        return livreur;
    }

    private void validateLivreur(CreateLivreurRequest request) {
        if (request == null || request.email() == null || request.email().isBlank()
                || request.motDePasse() == null || request.motDePasse().length() < 8
                || request.nom() == null || request.nom().isBlank()
                || request.prenom() == null || request.prenom().isBlank()) {
            throw new IllegalArgumentException("Livreur invalide");
        }
    }

    private void validateConsumption(double consumption) {
        if (!Double.isFinite(consumption) || consumption < 2 || consumption > 30) {
            throw new IllegalArgumentException("Consommation attendue entre 2 et 30 L/100 km");
        }
    }

    public static class DuplicateDataException extends RuntimeException {
    }
}
