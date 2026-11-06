package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.EspaceLivreurDto.*;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.StatutLivraison;
import com.fleetpulse.livraison.Repository.*;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Espace du coursier (US-2B8) : se declarer disponible ou non, consulter ses missions de collecte.
 * Un coursier ne peut se declarer disponible que s'il se trouve dans l'une de ses zones autorisees.
 */
@Service @RequiredArgsConstructor @Transactional
public class EspaceLivreurService {
    private final LivreurRepository livreurs;
    private final AffectationZoneRepository affectations;
    private final LivraisonRepository commandes;
    private final ZoneService zones;
    private final AffectationMissionService affectationMissions;
    private final CommandeWorkflow workflow;

    @Transactional(readOnly = true)
    public DisponibiliteVue disponibilite(String email) {
        return vue(livreur(email));
    }

    public DisponibiliteVue changerDisponibilite(String email, DisponibiliteRequest r) {
        if (r == null || r.disponible() == null) throw new IllegalArgumentException("Indiquez si vous êtes disponible.");
        Livreur livreur = livreur(email);
        Instant maintenant = Instant.now().truncatedTo(ChronoUnit.MICROS);

        if (!r.disponible()) {
            livreur.setDisponible(false);
            livreur.setDisponibiliteMiseAJourLe(maintenant);
            return vue(livreur);
        }

        ZoneService.position(r.latitude(), r.longitude());
        List<AffectationZone> autorisees = zonesEnVigueur(livreur.getId(), maintenant);
        if (autorisees.isEmpty())
            throw MarketplaceException.conflit("Aucune zone ne vous est affectée pour le moment. Contactez le responsable.");
        Optional<Zone> zoneIci = zones.trouver(r.latitude(), r.longitude());
        boolean dansUneZoneAutorisee = zoneIci.isPresent()
                && autorisees.stream().anyMatch(a -> a.getZone().getId().equals(zoneIci.get().getId()));
        if (!dansUneZoneAutorisee)
            throw MarketplaceException.conflit("Vous êtes hors de vos zones (" + noms(autorisees)
                    + "). Rendez-vous dans l'une d'elles pour vous déclarer disponible.");

        livreur.setDisponible(true);
        livreur.setDerniereLatitude(r.latitude());
        livreur.setDerniereLongitude(r.longitude());
        livreur.setDisponibiliteMiseAJourLe(maintenant);
        affectationMissions.affecterCommandesEnAttente(livreur, autorisees.stream().map(a -> a.getZone().getId()).toList());
        return vue(livreur);
    }

    @Transactional(readOnly = true)
    public List<MissionVue> missions(String email) {
        Livreur livreur = livreur(email);
        return commandes.findAllByLivreurIdAndStatutInOrderByAffecteeLeAsc(livreur.getId(), AffectationMissionService.MISSIONS_EN_COURS)
                .stream().map(MissionVue::from).toList();
    }

    @Transactional(readOnly = true)
    public MissionVue mission(String email, Long id) {
        return MissionVue.from(mission(livreur(email), id, false));
    }

    /**
     * US-2B9 : le coursier confirme la prise en charge en scannant le QR du colis (ou en saisissant son code).
     * Rejouer la meme collecte (reseau instable) renvoie la mission sans rien changer.
     */
    public MissionVue confirmerCollecte(String email, Long id, CollecteRequest r) {
        Livreur livreur = livreur(email);
        Livraison commande = mission(livreur, id, true);
        if (commande.getStatut() == StatutLivraison.RECUPEREE) return MissionVue.from(commande);
        if (commande.getStatut() != StatutLivraison.AFFECTEE)
            throw MarketplaceException.conflit("Cette commande n'attend plus de collecte.");

        String code = CodeCollecte.lire(r == null ? null : r.code(), commande.getCodeSuivi());
        if (!CodeCollecte.correspond(commande.getCodeCollecte(), code))
            throw new IllegalArgumentException("Code de collecte incorrect : vérifiez l'étiquette du colis.");

        commande.setRecupereeLe(Instant.now().truncatedTo(ChronoUnit.MICROS));
        workflow.transition(commande, StatutLivraison.RECUPEREE, livreur, "Colis scanné à la boutique");
        return MissionVue.from(commande);
    }

    /** Mission d'un autre coursier : 404, sans reveler son existence. verrou : pour la collecte. */
    private Livraison mission(Livreur livreur, Long id, boolean verrou) {
        return (verrou ? commandes.verrouiller(id) : commandes.findById(id))
                .filter(c -> c.getLivreur() != null && c.getLivreur().getId().equals(livreur.getId()))
                .orElseThrow(MarketplaceException::absent);
    }

    private Livreur livreur(String email) {
        return livreurs.findByEmail(email).orElseThrow(MarketplaceException::absent);
    }

    private List<AffectationZone> zonesEnVigueur(Long livreurId, Instant maintenant) {
        return affectations.findAllByLivreurIdOrderByTypeAscIdAsc(livreurId).stream().filter(a -> a.enVigueur(maintenant)).toList();
    }

    private static String noms(List<AffectationZone> autorisees) {
        return String.join(", ", autorisees.stream().map(a -> a.getZone().getNom()).toList());
    }

    private DisponibiliteVue vue(Livreur livreur) {
        Instant maintenant = Instant.now();
        List<ZoneAutorisee> zonesAutorisees = affectations.findAllByLivreurIdOrderByTypeAscIdAsc(livreur.getId()).stream()
                .map(a -> ZoneAutorisee.from(a, maintenant)).toList();
        return new DisponibiliteVue(livreur.estDisponible(), livreur.getDisponibiliteMiseAJourLe(), zonesAutorisees);
    }
}
