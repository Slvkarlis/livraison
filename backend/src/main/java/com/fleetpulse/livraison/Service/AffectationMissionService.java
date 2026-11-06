package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.StatutLivraison;
import com.fleetpulse.livraison.Model.enums.TypeAffectation;
import com.fleetpulse.livraison.Repository.*;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * US-2B8 : affectation simple d'une commande prete a un coursier disponible, dans la zone du commerce.
 *
 * <p>Choix du coursier : zone principale d'abord, puis secondaire, puis renfort temporaire ; a egalite,
 * le moins charge. Un coursier porte au plus {@link #MISSIONS_MAX} missions a la fois.
 * Sans coursier disponible, la commande attend : elle est affectee des qu'un coursier de la zone se declare disponible.
 *
 * <p>Remplacee par le dispatch IA par lots au Sprint 4.
 */
@Service @RequiredArgsConstructor @Transactional
public class AffectationMissionService {
    static final int MISSIONS_MAX = 3;
    /** Missions en cours : affectees, puis collectees (jusqu'a la livraison, Sprint 3). */
    static final Set<StatutLivraison> MISSIONS_EN_COURS = EnumSet.of(StatutLivraison.AFFECTEE, StatutLivraison.RECUPEREE);

    private final AffectationZoneRepository affectations;
    private final LivraisonRepository commandes;
    private final CommandeWorkflow workflow;

    /** Coursier candidat pour une zone : son type d'affectation et sa charge actuelle. */
    private record Candidat(Livreur livreur, TypeAffectation type, long missions) { }

    /** Appelee quand une commande devient prete. */
    public void affecterSiPossible(Livraison commande) {
        Zone zone = commande.getPartenaire() == null ? null : commande.getPartenaire().getZone();
        if (zone == null || commande.getLivreur() != null || commande.getStatut() != StatutLivraison.PRETE) return;
        choisirLivreur(zone.getId()).ifPresent(livreur -> affecter(commande, livreur));
    }

    /** Appelee quand un coursier se declare disponible : il prend les commandes pretes qui attendent dans ses zones. */
    public void affecterCommandesEnAttente(Livreur livreur, Collection<Long> zoneIds) {
        List<Livraison> enAttente = commandes.findAllByStatutAndLivreurIsNullAndPartenaireZoneIdInOrderByPreteLeAsc(StatutLivraison.PRETE, zoneIds);
        for (Livraison c : enAttente) {
            if (missionsEnCours(livreur) >= MISSIONS_MAX) return;
            // Verrou : la commande peut etre prise au meme moment par un autre coursier
            Livraison commande = commandes.verrouiller(c.getId()).orElseThrow();
            if (commande.getLivreur() == null && commande.getStatut() == StatutLivraison.PRETE) affecter(commande, livreur);
        }
    }

    private Optional<Livreur> choisirLivreur(Long zoneId) {
        Instant maintenant = Instant.now();
        return affectations.findAllByZoneId(zoneId).stream()
                .filter(a -> a.enVigueur(maintenant) && a.getLivreur().estDisponible())
                .map(a -> new Candidat(a.getLivreur(), a.getType(), missionsEnCours(a.getLivreur())))
                .filter(c -> c.missions() < MISSIONS_MAX)
                // TypeAffectation se compare dans l'ordre de declaration : PRINCIPALE, SECONDAIRE, TEMPORAIRE
                .min(Comparator.comparing(Candidat::type)
                        .thenComparingLong(Candidat::missions)
                        .thenComparing(c -> c.livreur().getId()))
                .map(Candidat::livreur);
    }

    private void affecter(Livraison commande, Livreur livreur) {
        // Le coursier est renseigne avant la transition : l'evenement temps reel lui est aussi envoye
        commande.setLivreur(livreur);
        commande.setAffecteeLe(Instant.now().truncatedTo(ChronoUnit.MICROS));
        workflow.transition(commande, StatutLivraison.AFFECTEE, livreur, "Affectation automatique : " + livreur.getPrenom());
    }

    private long missionsEnCours(Livreur livreur) {
        return commandes.countByLivreurIdAndStatutIn(livreur.getId(), MISSIONS_EN_COURS);
    }
}
