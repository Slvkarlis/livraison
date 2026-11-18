package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.NotationDto.*;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.*;
import com.fleetpulse.livraison.Repository.*;
import java.time.Instant;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @RequiredArgsConstructor @Transactional
public class NotationService {
    private final LivraisonRepository commandes;
    private final UtilisateurRepository utilisateurs;
    private final NotationRepository notes;

    @Transactional(readOnly = true)
    public NotesVue consulter(String email, Long id) {
        Livraison c = commandes.findById(id).orElseThrow(MarketplaceException::absent);
        Utilisateur auteur = auteur(email);
        List<Utilisateur> cibles = cibles(c, auteur);
        return vue(c, auteur, cibles);
    }

    public NotesVue noter(String email, Long id, Demande demande) {
        // Le verrou sérialise aussi deux envois concurrents d'un même participant.
        Livraison c = commandes.verrouiller(id).orElseThrow(MarketplaceException::absent);
        Utilisateur auteur = auteur(email);
        List<Utilisateur> cibles = cibles(c, auteur);
        if (c.getStatut() != StatutLivraison.LIVREE)
            throw MarketplaceException.conflit("Vous pourrez noter après la livraison.");
        if (demande == null || demande.cible() == null || demande.note() == null || demande.note() < 1 || demande.note() > 5)
            throw new IllegalArgumentException("Choisissez une cible et une note entière de 1 à 5.");
        if (demande.commentaire() != null && demande.commentaire().length() > 500)
            throw new IllegalArgumentException("Commentaire : 500 caractères maximum.");
        Utilisateur cible = cibles.stream().filter(u -> u.getRole() == demande.cible()).findFirst()
                .orElseThrow(() -> new AccessDeniedException("Cette cible ne peut pas être notée par ce participant."));
        if (notes.existsByCommandeIdAndAuteurIdAndCibleId(id, auteur.getId(), cible.getId()))
            throw MarketplaceException.conflit("Cette note est déjà enregistrée et ne peut pas être modifiée.");
        notes.saveAndFlush(new Notation(demande.note(), demande.commentaire() == null ? null : demande.commentaire().trim(),
                auteur, cible, c, Instant.now()));
        return vue(c, auteur, cibles);
    }

    private Utilisateur auteur(String email) {
        return utilisateurs.findByEmail(email).orElseThrow(() -> new AccessDeniedException("Participant requis."));
    }

    private List<Utilisateur> cibles(Livraison c, Utilisateur auteur) {
        if (auteur.getRole() == Role.CLIENT && c.getClient().getId().equals(auteur.getId()))
            return java.util.stream.Stream.of(c.getPartenaire(), c.getLivreur()).filter(Objects::nonNull).map(u -> (Utilisateur) u).toList();
        if (auteur.getRole() == Role.LIVREUR && c.getLivreur() != null && c.getLivreur().getId().equals(auteur.getId()))
            return List.of(c.getClient());
        if (auteur.getRole() == Role.PARTENAIRE && c.getPartenaire() != null && c.getPartenaire().getId().equals(auteur.getId()))
            return c.getLivreur() == null ? List.of() : List.of(c.getLivreur());
        throw new AccessDeniedException("Seuls les participants réels peuvent noter cette commande.");
    }

    private NotesVue vue(Livraison c, Utilisateur auteur, List<Utilisateur> cibles) {
        return new NotesVue(c.getStatut() == StatutLivraison.LIVREE, cibles.stream().map(Utilisateur::getRole).toList(),
                notes.findByCommandeIdAndAuteurIdOrderByIdAsc(c.getId(), auteur.getId()).stream()
                        .map(n -> new NoteVue(n.getCible().getRole(), n.getNote(), n.getCommentaire(), n.getDate())).toList());
    }
}
