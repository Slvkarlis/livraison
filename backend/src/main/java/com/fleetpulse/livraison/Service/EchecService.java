package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.EchecDto.*;
import com.fleetpulse.livraison.Model.Livraison;
import com.fleetpulse.livraison.Model.Livreur;
import com.fleetpulse.livraison.Model.Utilisateur;
import com.fleetpulse.livraison.Model.enums.ActionAudit;
import com.fleetpulse.livraison.Model.enums.DecisionEchec;
import com.fleetpulse.livraison.Model.enums.MotifEchec;
import com.fleetpulse.livraison.Model.enums.StatutLivraison;
import com.fleetpulse.livraison.Repository.LivraisonRepository;
import com.fleetpulse.livraison.Repository.LivreurRepository;
import com.fleetpulse.livraison.Repository.UtilisateurRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Echecs de livraison (Sprint 7).
 * US-308 : le coursier declare un echec avec un motif, la commande passe en ECHEC.
 * US-312 : le responsable decide du sort (relivraison, retour au partenaire, perte). Une seule decision par echec.
 */
@Service @RequiredArgsConstructor @Transactional
public class EchecService {
    /** Statuts dans lesquels le coursier a encore le colis en main. */
    static final List<StatutLivraison> ECHEC_DECLARABLE = List.of(StatutLivraison.RECUPEREE, StatutLivraison.A_PROXIMITE);

    private final LivraisonRepository commandes;
    private final LivreurRepository livreurs;
    private final UtilisateurRepository utilisateurs;
    private final CommandeWorkflow workflow;
    private final AuditService audit;

    /** US-308 : declaration par le coursier affecte a la commande. */
    public com.fleetpulse.livraison.Dto.EspaceLivreurDto.MissionVue declarer(String email, Long id, EchecRequest r) {
        Livreur livreur = livreurs.findByEmail(email).orElseThrow(MarketplaceException::absent);
        Livraison c = commandes.verrouiller(id)
                .filter(x -> x.getLivreur() != null && x.getLivreur().getId().equals(livreur.getId()))
                .orElseThrow(MarketplaceException::absent);
        if (c.getStatut() == StatutLivraison.ECHEC)
            return com.fleetpulse.livraison.Dto.EspaceLivreurDto.MissionVue.from(c);   // rejeu reseau : sans effet
        if (!ECHEC_DECLARABLE.contains(c.getStatut()))
            throw MarketplaceException.conflit("Un échec ne peut être déclaré qu'après la collecte, pas au statut " + c.getStatut() + ".");
        if (r == null || r.motif() == null)
            throw new IllegalArgumentException("Choisissez un motif d'échec.");
        String commentaire = r.commentaire() == null ? null : r.commentaire().strip();
        if (r.motif() == MotifEchec.INCIDENT && (commentaire == null || commentaire.length() < 5))
            throw new IllegalArgumentException("Décrivez l'incident (5 caractères minimum).");
        if (commentaire != null && commentaire.length() > 300)
            throw new IllegalArgumentException("Commentaire trop long (300 caractères maximum).");

        Instant maintenant = Instant.now().truncatedTo(ChronoUnit.MICROS);
        c.setMotifEchec(r.motif());
        c.setCommentaireEchec(commentaire == null || commentaire.isEmpty() ? null : commentaire);
        c.setEchecLe(maintenant);
        workflow.transition(c, StatutLivraison.ECHEC, livreur, "Échec : " + r.motif().name());
        audit.enregistrer(ActionAudit.ECHEC_DECLARE, "COMMANDE", c.getId(), c.getCodeSuivi() + " : " + r.motif().name());
        return com.fleetpulse.livraison.Dto.EspaceLivreurDto.MissionVue.from(c);
    }

    /** US-312 : decision du responsable sur une commande en echec. */
    public EchecVue decider(String email, Long id, DecisionRequest r) {
        Utilisateur responsable = utilisateurs.findByEmail(email).orElseThrow(MarketplaceException::absent);
        Livraison c = commandes.verrouiller(id).orElseThrow(MarketplaceException::absent);
        if (c.getStatut() != StatutLivraison.ECHEC)
            throw MarketplaceException.conflit("Seule une commande en échec peut recevoir une décision (statut actuel : " + c.getStatut() + ").");
        if (c.getDecisionEchec() != null)
            throw MarketplaceException.conflit("Une décision a déjà été prise : " + c.getDecisionEchec() + ".");
        if (r == null || r.decision() == null)
            throw new IllegalArgumentException("Choisissez une décision.");
        String commentaire = r.commentaire() == null || r.commentaire().isBlank() ? null : r.commentaire().strip();
        if (commentaire != null && commentaire.length() > 300)
            throw new IllegalArgumentException("Commentaire trop long (300 caractères maximum).");

        Instant maintenant = Instant.now().truncatedTo(ChronoUnit.MICROS);
        c.setDecisionEchec(r.decision());
        c.setCommentaireDecisionEchec(commentaire);
        c.setDecisionEchecLe(maintenant);
        switch (r.decision()) {
            case RELIVRAISON -> workflow.transition(c, StatutLivraison.RECUPEREE, responsable, "Relivraison décidée par le responsable");
            case RETOUR_PARTENAIRE -> workflow.transition(c, StatutLivraison.RETOURNEE, responsable, "Retour au partenaire");
            case PERTE -> workflow.noter(c, responsable, "Colis déclaré perdu : imputation à traiter (US-517)");
        }
        audit.enregistrer(ActionAudit.ECHEC_DECIDE, "COMMANDE", c.getId(), c.getCodeSuivi() + " : " + r.decision().name());
        return vue(c);
    }

    @Transactional(readOnly = true)
    public List<EchecVue> echecs() {
        return commandes.findAllByStatutOrderByEchecLeDesc(StatutLivraison.ECHEC).stream().map(EchecService::vue).toList();
    }

    static EchecVue vue(Livraison c) {
        String zone = c.getNomZone();
        return new EchecVue(c.getId(), c.getCodeSuivi(), c.getStatut().name(), c.getNomPartenaire(), zone,
                c.getMotifEchec(), c.getCommentaireEchec(), c.getEchecLe(),
                c.getDecisionEchec(), c.getCommentaireDecisionEchec(), c.getDecisionEchecLe());
    }
}
