package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.JournalAuditResponse;
import com.fleetpulse.livraison.Model.JournalAudit;
import com.fleetpulse.livraison.Model.Utilisateur;
import com.fleetpulse.livraison.Model.enums.ActionAudit;
import com.fleetpulse.livraison.Repository.JournalAuditRepository;
import java.util.List;
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
}
