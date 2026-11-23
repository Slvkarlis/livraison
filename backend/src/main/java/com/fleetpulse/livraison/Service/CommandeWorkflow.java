package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Model.HistoriqueStatut;
import com.fleetpulse.livraison.Model.Livraison;
import com.fleetpulse.livraison.Model.Livreur;
import com.fleetpulse.livraison.Model.Partenaire;
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
        // ANNULEE apres l'acceptation : seulement le responsable (US-311), le client etant limite par CommandeService.ANNULABLES
        TRANSITIONS.put(EN_PREPARATION, EnumSet.of(PRETE, ANNULEE));
        TRANSITIONS.put(PRETE, EnumSet.of(AFFECTEE, ANNULEE));
        TRANSITIONS.put(AFFECTEE, EnumSet.of(RECUPEREE, ANNULEE));
        // Sprint 3 : Last Mile
        // Sprint 7 : echec declare par le coursier, puis decision du responsable (relivraison ou retour)
        TRANSITIONS.put(RECUPEREE, EnumSet.of(A_PROXIMITE, LIVREE, ANNULEE, ECHEC));
        TRANSITIONS.put(A_PROXIMITE, EnumSet.of(LIVREE, ANNULEE, ECHEC));
        TRANSITIONS.put(ECHEC, EnumSet.of(RECUPEREE, RETOURNEE));
    }

    private final HistoriqueStatutRepository historique;
    private final ApplicationEventPublisher evenements;

    public static boolean autorisee(StatutLivraison de, StatutLivraison vers) {
        return de != null && TRANSITIONS.getOrDefault(de, Set.of()).contains(vers);
    }

    /** Premiere entree de l'historique, a la creation de la commande. */
    public void creer(Livraison commande, Utilisateur acteur) {
        historique.save(new HistoriqueStatut(commande, null, commande.getStatut(), acteur, null));
        publier(commande, null, acteur);
    }

    public void transition(Livraison commande, StatutLivraison cible, Utilisateur acteur, String motif) {
        StatutLivraison ancien = commande.getStatut();
        if (!autorisee(ancien, cible))
            throw MarketplaceException.conflit("Action impossible : la commande est au statut " + ancien + ".");
        commande.setStatut(cible);
        historique.save(new HistoriqueStatut(commande, ancien, cible, acteur, motif));
        publier(commande, ancien, acteur);
    }

    /** Evenement sans changement de statut (ex. delai ajuste) : trace dans l'historique avec ancien = nouveau. */
    public void noter(Livraison commande, Utilisateur acteur, String motif) {
        historique.save(new HistoriqueStatut(commande, commande.getStatut(), commande.getStatut(), acteur, motif));
        publier(commande, commande.getStatut(), acteur);
    }

    private void publier(Livraison commande, StatutLivraison ancien, Utilisateur acteur) {
        Partenaire p = commande.getPartenaire();
        Livreur livreur = commande.getLivreur();
        evenements.publishEvent(new CommandeStatutChange(commande.getId(), p == null ? null : p.getId(), p == null ? null : p.getEmail(),
                commande.getClient().getId(), commande.getClient().getEmail(), livreur == null ? null : livreur.getEmail(),
                ancien, commande.getStatut(), acteur == null ? null : acteur.getRole()));
    }
}
