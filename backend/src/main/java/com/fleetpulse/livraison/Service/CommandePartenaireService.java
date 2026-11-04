package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.CommandePartenaireDto.*;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.StatutLivraison;
import com.fleetpulse.livraison.Repository.*;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Commandes recues par le partenaire connecte (US-2B1). */
@Service @RequiredArgsConstructor @Transactional(readOnly = true)
public class CommandePartenaireService {
    private final PartenaireRepository partenaires;
    private final LivraisonRepository commandes;
    private final HistoriqueStatutRepository historique;

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
        Livraison c = commande(partenaireActif(email), id);
        return CommandeDetail.from(c, historique.findAllByCommandeIdOrderByDateAscIdAsc(c.getId()));
    }

    /** Commande d'un autre partenaire : 404, sans reveler son existence. */
    Livraison commande(Partenaire p, Long id) {
        return commandes.findById(id)
                .filter(c -> c.getPartenaire() != null && c.getPartenaire().getId().equals(p.getId()))
                .orElseThrow(MarketplaceException::absent);
    }
}
