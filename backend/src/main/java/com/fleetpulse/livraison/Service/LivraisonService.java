package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Config.TarificationProperties;
import com.fleetpulse.livraison.Dto.CreateLivraisonRequest;
import com.fleetpulse.livraison.Dto.DevisRequest;
import com.fleetpulse.livraison.Dto.DevisResponse;
import com.fleetpulse.livraison.Dto.LivraisonResponse;
import com.fleetpulse.livraison.Model.Client;
import com.fleetpulse.livraison.Model.Livraison;
import com.fleetpulse.livraison.Model.enums.ModePaiement;
import com.fleetpulse.livraison.Model.enums.StatutPaiement;
import com.fleetpulse.livraison.Model.enums.TypeLivraison;
import com.fleetpulse.livraison.Repository.LivraisonRepository;
import com.fleetpulse.livraison.Repository.UtilisateurRepository;
import com.fleetpulse.livraison.Service.TarificationService.Devis;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LivraisonService {
    private static final Duration DUREE_MAX_CRENEAU = Duration.ofHours(4);
    private static final Duration TOLERANCE_CRENEAU = Duration.ofMinutes(5);

    @Autowired
    private LivraisonRepository livraisonRepository;
    @Autowired
    private UtilisateurRepository utilisateurRepository;
    @Autowired
    private TarificationService tarificationService;
    @Autowired
    private TarificationProperties tarification;
    @Autowired
    private StripeService stripeService;
    @Autowired private ZoneService zoneService;

    /** Prix affiche au client avant qu'il confirme sa commande. */
    public DevisResponse devis(DevisRequest request) {
        if (request == null || !validCoordinates(request.latitude(), request.longitude())) {
            throw new IllegalArgumentException("Position de livraison invalide.");
        }
        TypeLivraison type = request.typeLivraison() == null ? TypeLivraison.PLANIFIEE : request.typeLivraison();
        double frais = zoneService.desservie(request.latitude(), request.longitude()).getFraisLivraison().doubleValue();
        Devis devis = new Devis(0, frais, 0, frais);
        return DevisResponse.from(type, devis, tarification.delaiImmediatMinutes());
    }

    @Transactional
    public LivraisonResponse createForUser(CreateLivraisonRequest request, String userEmail) {
        validate(request);
        Client client = utilisateurRepository.findByEmail(userEmail)
                .filter(Client.class::isInstance)
                .map(Client.class::cast)
                .orElseThrow(() -> new IllegalArgumentException("L'utilisateur n'est pas un client"));

        TypeLivraison type = request.typeLivraison();
        Instant maintenant = Instant.now();
        // Le prix est toujours recalcule ici : le client ne peut pas le fixer.
        double frais = zoneService.desservie(request.latitude(), request.longitude()).getFraisLivraison().doubleValue();
        Devis devis = new Devis(0, frais, 0, frais);

        Livraison livraison = new Livraison();
        livraison.setCodeSuivi("FP-" + UUID.randomUUID().toString().substring(0, 12).toUpperCase());
        livraison.setClient(client);
        livraison.setAdresse(request.adresse().trim());
        livraison.setLatitude(request.latitude());
        livraison.setLongitude(request.longitude());
        livraison.setTypeLivraison(type);
        if (type == TypeLivraison.IMMEDIATE) {
            livraison.setCreneauDebut(maintenant);
            livraison.setCreneauFin(maintenant.plus(Duration.ofMinutes(tarification.delaiImmediatMinutes())));
        } else {
            livraison.setCreneauDebut(request.creneauDebut());
            livraison.setCreneauFin(request.creneauFin());
        }
        livraison.setModePaiement(request.modePaiement());
        livraison.setDistanceKm(devis.distanceKm());
        livraison.setFraisLivraison(devis.fraisLivraison());
        livraison.setSupplementImmediat(devis.supplementImmediat());
        // Carte : payee en ligne avant la livraison, le livreur n'encaisse rien.
        boolean carte = request.modePaiement() == ModePaiement.CARTE;
        livraison.setStatutPaiement(carte ? StatutPaiement.EN_ATTENTE : StatutPaiement.A_LA_LIVRAISON);
        livraison.setMontantACollecter(carte ? 0 : devis.total());
        livraison.setDateCreation(maintenant);
        return LivraisonResponse.from(livraisonRepository.save(livraison));
    }

    @Transactional(readOnly = true)
    public List<LivraisonResponse> listAll() {
        return livraisonRepository.findAllByOrderByDateCreationDesc().stream()
                .map(LivraisonResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<LivraisonResponse> listForClient(String clientEmail) {
        return livraisonRepository.findAllByClientEmailOrderByDateCreationDesc(clientEmail).stream()
                .map(LivraisonResponse::from).toList();
    }

    private void validate(CreateLivraisonRequest request) {
        if (request != null && request.modePaiement() == ModePaiement.COD)
            throw new IllegalArgumentException("Pour une commande COD, choisissez un partenaire et ses produits dans le catalogue.");
        if (request == null || request.adresse() == null || request.adresse().isBlank()) {
            throw new IllegalArgumentException("Indiquez l'adresse de livraison.");
        }
        if (!validCoordinates(request.latitude(), request.longitude())) {
            throw new IllegalArgumentException("Position de livraison invalide.");
        }
        if (request.typeLivraison() == null) {
            throw new IllegalArgumentException("Choisissez une livraison immédiate ou un créneau.");
        }
        if (request.modePaiement() == null) {
            throw new IllegalArgumentException("Choisissez un mode de paiement.");
        }
        if (request.modePaiement() == ModePaiement.CARTE && !stripeService.actif()) {
            throw new IllegalArgumentException("Le paiement par carte n'est pas disponible pour le moment.");
        }
        if (request.typeLivraison() == TypeLivraison.PLANIFIEE) {
            Instant debut = request.creneauDebut();
            Instant fin = request.creneauFin();
            if (debut == null || fin == null || !fin.isAfter(debut)
                    || debut.isBefore(Instant.now().minus(TOLERANCE_CRENEAU))
                    || Duration.between(debut, fin).compareTo(DUREE_MAX_CRENEAU) > 0) {
                throw new IllegalArgumentException("Créneau invalide ou déjà passé.");
            }
        }
    }

    private boolean validCoordinates(Double latitude, Double longitude) {
        return latitude != null && longitude != null
                && Double.isFinite(latitude) && Double.isFinite(longitude)
                && latitude >= -90 && latitude <= 90
                && longitude >= -180 && longitude <= 180;
    }
}
