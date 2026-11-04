package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.CommandePartenaireDto.*;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.MotifRefus;
import com.fleetpulse.livraison.Model.enums.StatutLivraison;
import com.fleetpulse.livraison.Repository.*;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Commandes recues par le partenaire connecte (US-2B1) et sa decision (US-2B2). */
@Service @RequiredArgsConstructor @Transactional(readOnly = true)
public class CommandePartenaireService {
    static final int PREPARATION_MIN = 1, PREPARATION_MAX = 180, COMMENTAIRE_MAX = 300;
    private final PartenaireRepository partenaires;
    private final LivraisonRepository commandes;
    private final HistoriqueStatutRepository historique;
    private final CommandeWorkflow workflow;

    Partenaire partenaireActif(String email) {
        Partenaire p = partenaires.findByEmail(email).orElseThrow(MarketplaceException::absent);
        if (!p.isActif()) throw new AccessDeniedException("Partenaire non validé.");
        return p;
    }

    public List<CommandeResume> lister(String email, List<StatutLivraison> statuts) {
        Long id = partenaireActif(email).getId();
        List<Livraison> liste = statuts == null || statuts.isEmpty()
                ? commandes.findAllByPartenaireIdOrderByDateCreationDesc(id)
                : commandes.findAllByPartenaireIdAndStatutInOrderByDateCreationDesc(id, statuts);
        return liste.stream().map(CommandeResume::from).toList();
    }

    public CommandeDetail detail(String email, Long id) {
        Livraison c = commande(partenaireActif(email), id, false);
        return vue(c);
    }

    /** US-2B2 : acceptation avec temps de preparation annonce. Rejouer la meme decision ne change rien. */
    @Transactional
    public CommandeDetail accepter(String email, Long id, AcceptationRequest r) {
        Integer minutes = r == null ? null : r.tempsPreparationMinutes();
        if (minutes == null || minutes < PREPARATION_MIN || minutes > PREPARATION_MAX)
            throw new IllegalArgumentException("Temps de préparation : de " + PREPARATION_MIN + " à " + PREPARATION_MAX + " minutes.");
        Partenaire p = partenaireActif(email);
        Livraison c = commande(p, id, true);
        if (c.getStatut() == StatutLivraison.ACCEPTEE) return vue(c);
        workflow.transition(c, StatutLivraison.ACCEPTEE, p, "Préparation annoncée : " + minutes + " min");
        c.setTempsPreparationMinutes(minutes);
        c.setAccepteeLe(Instant.now());
        return vue(c);
    }

    /** US-2B2 : refus motive (AUTRE exige un commentaire). Rejouer le meme refus ne change rien. */
    @Transactional
    public CommandeDetail refuser(String email, Long id, RefusRequest r) {
        MotifRefus motif = r == null ? null : r.motif();
        String commentaire = r == null || r.commentaire() == null || r.commentaire().isBlank() ? null : r.commentaire().trim();
        if (motif == null) throw new IllegalArgumentException("Choisissez un motif de refus.");
        if (motif == MotifRefus.AUTRE && commentaire == null) throw new IllegalArgumentException("Précisez le motif du refus.");
        if (commentaire != null && commentaire.length() > COMMENTAIRE_MAX)
            throw new IllegalArgumentException("Commentaire : " + COMMENTAIRE_MAX + " caractères maximum.");
        Partenaire p = partenaireActif(email);
        Livraison c = commande(p, id, true);
        if (c.getStatut() == StatutLivraison.REFUSEE) return vue(c);
        workflow.transition(c, StatutLivraison.REFUSEE, p, motif.libelle() + (commentaire == null ? "" : " : " + commentaire));
        c.setMotifRefus(motif);
        c.setCommentaireRefus(commentaire);
        return vue(c);
    }

    private CommandeDetail vue(Livraison c) {
        return CommandeDetail.from(c, historique.findAllByCommandeIdOrderByDateAscIdAsc(c.getId()));
    }

    /** Commande d'un autre partenaire : 404, sans reveler son existence. verrou : pour une decision. */
    Livraison commande(Partenaire p, Long id, boolean verrou) {
        return (verrou ? commandes.verrouiller(id) : commandes.findById(id))
                .filter(c -> c.getPartenaire() != null && c.getPartenaire().getId().equals(p.getId()))
                .orElseThrow(MarketplaceException::absent);
    }
}
