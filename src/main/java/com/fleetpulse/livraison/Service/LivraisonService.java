package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.CreateLivraisonRequest;
import com.fleetpulse.livraison.Dto.LivraisonResponse;
import com.fleetpulse.livraison.Model.Client;
import com.fleetpulse.livraison.Model.Livraison;
import com.fleetpulse.livraison.Repository.LivraisonRepository;
import com.fleetpulse.livraison.Repository.UtilisateurRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LivraisonService {
    private final LivraisonRepository livraisonRepository;
    private final UtilisateurRepository utilisateurRepository;

    public LivraisonService(LivraisonRepository livraisonRepository,
                            UtilisateurRepository utilisateurRepository) {
        this.livraisonRepository = livraisonRepository;
        this.utilisateurRepository = utilisateurRepository;
    }

    @Transactional
    public LivraisonResponse createForUser(CreateLivraisonRequest request, String userEmail) {
        validate(request);
        Client client = utilisateurRepository.findByEmail(userEmail)
                .filter(Client.class::isInstance)
                .map(Client.class::cast)
                .orElseThrow(() -> new IllegalArgumentException("L'utilisateur n'est pas un client"));

        Livraison livraison = new Livraison();
        livraison.setCodeSuivi("FP-" + UUID.randomUUID().toString().substring(0, 12).toUpperCase());
        livraison.setClient(client);
        livraison.setAdresse(request.adresse().trim());
        livraison.setLatitude(request.latitude());
        livraison.setLongitude(request.longitude());
        livraison.setCreneauDebut(request.creneauDebut());
        livraison.setCreneauFin(request.creneauFin());
        livraison.setModePaiement(request.modePaiement());
        livraison.setMontantACollecter(request.montantACollecter());
        livraison.setDateCreation(Instant.now());
        return LivraisonResponse.from(livraisonRepository.save(livraison));
    }

    @Transactional(readOnly = true)
    public List<LivraisonResponse> listAll() {
        return livraisonRepository.findAllByOrderByDateCreationDesc().stream()
                .map(LivraisonResponse::from).toList();
    }

    private void validate(CreateLivraisonRequest request) {
        if (request == null || request.adresse() == null || request.adresse().isBlank()
                || !validCoordinates(request.latitude(), request.longitude())
                || request.creneauDebut() == null || request.creneauFin() == null
                || !request.creneauFin().isAfter(request.creneauDebut())
                || request.modePaiement() == null
                || request.montantACollecter() < 0) {
            throw new IllegalArgumentException("Commande invalide");
        }
    }

    private boolean validCoordinates(Double latitude, Double longitude) {
        return latitude != null && longitude != null
                && Double.isFinite(latitude) && Double.isFinite(longitude)
                && latitude >= -90 && latitude <= 90
                && longitude >= -180 && longitude <= 180;
    }
}
