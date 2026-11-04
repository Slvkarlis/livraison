package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Model.HistoriqueStatut;
import com.fleetpulse.livraison.Model.Livraison;
import com.fleetpulse.livraison.Model.Utilisateur;
import com.fleetpulse.livraison.Model.enums.StatutLivraison;
import com.fleetpulse.livraison.Repository.HistoriqueStatutRepository;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import static com.fleetpulse.livraison.Model.enums.StatutLivraison.*;

/**
 * Seul point de changement du statut d'une commande : verifie la transition, ecrit l'historique, publie l'evenement.
 * Les droits (qui peut accepter, annuler...) sont verifies par les services appelants.
 */
@Service @RequiredArgsConstructor @Transactional
public class CommandeWorkflow {
    private static final Map<StatutLivraison, Set<StatutLivraison>> TRANSITIONS = new EnumMap<>(StatutLivraison.class);
    static {
        TRANSITIONS.put(PENDING_PARTNER, EnumSet.of(ACCEPTEE, REFUSEE, ANNULEE));
        TRANSITIONS.put(ACCEPTEE, EnumSet.of(EN_PREPARATION, PRETE, ANNULEE));
        TRANSITIONS.put(EN_PREPARATION, EnumSet.of(PRETE));
        TRANSITIONS.put(PRETE, EnumSet.of(AFFECTEE));
        TRANSITIONS.put(AFFECTEE, EnumSet.of(RECUPEREE));
    }

    private final HistoriqueStatutRepository historique;
    private final ApplicationEventPublisher evenements;

    public static boolean autorisee(StatutLivraison de, StatutLivraison vers) {
        return de != null && TRANSITIONS.getOrDefault(de, Set.of()).contains(vers);
    }

    /** Premiere entree de l'historique, a la creation de la commande. */
    public void creer(Livraison commande, Utilisateur acteur) {
        historique.save(new HistoriqueStatut(commande, null, commande.getStatut(), acteur, null));
        publier(commande, null);
    }

    public void transition(Livraison commande, StatutLivraison cible, Utilisateur acteur, String motif) {
        StatutLivraison ancien = commande.getStatut();
        if (!autorisee(ancien, cible))
            throw MarketplaceException.conflit("Action impossible : la commande est au statut " + ancien + ".");
        commande.setStatut(cible);
        historique.save(new HistoriqueStatut(commande, ancien, cible, acteur, motif));
        publier(commande, ancien);
    }

    /** Evenement sans changement de statut (ex. delai ajuste) : trace dans l'historique avec ancien = nouveau. */
    public void noter(Livraison commande, Utilisateur acteur, String motif) {
        historique.save(new HistoriqueStatut(commande, commande.getStatut(), commande.getStatut(), acteur, motif));
        publier(commande, commande.getStatut());
    }

    private void publier(Livraison commande, StatutLivraison ancien) {
        evenements.publishEvent(new CommandeStatutChange(commande.getId(),
                commande.getPartenaire() == null ? null : commande.getPartenaire().getId(),
                commande.getClient().getId(), ancien, commande.getStatut()));
    }
}
