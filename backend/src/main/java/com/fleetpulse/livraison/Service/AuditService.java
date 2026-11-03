package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.JournalAuditResponse;
import com.fleetpulse.livraison.Model.JournalAudit;
import com.fleetpulse.livraison.Model.Utilisateur;
import com.fleetpulse.livraison.Model.enums.ActionAudit;
import com.fleetpulse.livraison.Repository.JournalAuditRepository;
import java.util.List;
import java.time.Instant;
import java.util.ArrayList;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Limit;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Journal d'audit des actions sensibles (US-108). L'ecriture rejoint la transaction de l'action :
 * une action annulee ne laisse pas de trace trompeuse.
 */
@Service
public class AuditService {
    private static final int LIMITE_MAX = 500;

    @Autowired
    private JournalAuditRepository repository;

    /** Action sur un compte ; sans utilisateur connecte (inscription...), l'auteur est le titulaire du compte. */
    public void enregistrer(ActionAudit action, Utilisateur cible, String details) {
        enregistrer(action, cible.getRole().name(), cible.getId(), details, cible.getEmail());
    }

    public void enregistrer(ActionAudit action, String cibleType, Long cibleId, String details) {
        enregistrer(action, cibleType, cibleId, details, "anonyme");
    }

    private void enregistrer(ActionAudit action, String cibleType, Long cibleId, String details, String acteurParDefaut) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String acteur = authentication != null && authentication.isAuthenticated()
                && !(authentication instanceof AnonymousAuthenticationToken)
                ? authentication.getName() : acteurParDefaut;
        repository.save(new JournalAudit(acteur, action, cibleType, cibleId, details));
    }

    @Transactional(readOnly = true)
    public List<JournalAuditResponse> rechercher(String acteur, ActionAudit action, Long cibleId, Integer limite) {
        int taille = limite == null || limite < 1 ? 200 : Math.min(limite, LIMITE_MAX);
        String filtreActeur = acteur == null || acteur.isBlank() ? null : acteur.trim().toLowerCase();
        return repository.rechercher(filtreActeur, action, cibleId, Limit.of(taille)).stream()
                .map(JournalAuditResponse::from).toList();
    }
    @Transactional(readOnly = true)
    public Page<JournalAuditResponse> page(String acteur, ActionAudit action, Instant debut, Instant fin,
                                           int page, int taille) {
        if (page < 0 || taille < 1 || taille > 100 || (debut != null && fin != null && debut.isAfter(fin))) {
            throw new IllegalArgumentException("Pagination ou intervalle de dates invalide.");
        }
        Specification<JournalAudit> filtre = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (acteur != null && !acteur.isBlank()) predicates.add(cb.equal(cb.lower(root.get("acteur")), acteur.trim().toLowerCase()));
            if (action != null) predicates.add(cb.equal(root.get("action"), action));
            if (debut != null) predicates.add(cb.greaterThanOrEqualTo(root.get("date"), debut));
            if (fin != null) predicates.add(cb.lessThan(root.get("date"), fin));
            return cb.and(predicates.toArray(Predicate[]::new));
        };
        return repository.findAll(filtre, PageRequest.of(page, taille, Sort.by(Sort.Direction.DESC, "date", "id")))
                .map(JournalAuditResponse::from);
    }
}
