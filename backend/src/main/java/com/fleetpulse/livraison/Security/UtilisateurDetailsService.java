package com.fleetpulse.livraison.Security;

import com.fleetpulse.livraison.Model.Responsable;
import com.fleetpulse.livraison.Model.Utilisateur;
import com.fleetpulse.livraison.Model.enums.StatutCompte;
import com.fleetpulse.livraison.Repository.UtilisateurRepository;
import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

/**
 * Charge un compte par email ou telephone. Droits (US-103) :
 * - compte ACTIF : ROLE_&lt;role&gt;, plus ROLE_OPERATIONS / ROLE_FINANCE selon le sous-role d'un Responsable
 *   (l'administrateur principal, sans sous-role, a ROLE_ADMIN et les deux sous-roles) ;
 * - dossier en cours (EN_ATTENTE, COMPLEMENT_DEMANDE) : seulement ROLE_CANDIDAT, pour suivre et corriger son dossier ;
 * - SUSPENDU ou REFUSE : compte desactive.
 */
@Service
public class UtilisateurDetailsService implements UserDetailsService {
    @Autowired
    private UtilisateurRepository utilisateurRepository;

    @Override
    public UserDetails loadUserByUsername(String identifiant) throws UsernameNotFoundException {
        Utilisateur utilisateur = utilisateurRepository.findByIdentifiant(identifiant)
                .orElseThrow(() -> new UsernameNotFoundException("Utilisateur introuvable"));

        return User.withUsername(utilisateur.getEmail())
                .password(utilisateur.getMotDePasseHash())
                .authorities(autorites(utilisateur))
                .disabled(utilisateur.getStatut() == StatutCompte.SUSPENDU
                        || utilisateur.getStatut() == StatutCompte.REFUSE)
                .build();
    }

    private static List<GrantedAuthority> autorites(Utilisateur utilisateur) {
        if (utilisateur.getStatut() != StatutCompte.ACTIF) {
            return List.of(new SimpleGrantedAuthority("ROLE_CANDIDAT"));
        }
        List<String> roles = new ArrayList<>(List.of(utilisateur.getRole().name()));
        if (utilisateur instanceof Responsable responsable) {
            if (responsable.getSousRole() == null) roles.addAll(List.of("ADMIN", "OPERATIONS", "FINANCE"));
            else roles.add(responsable.getSousRole().name());
        }
        return roles.stream().<GrantedAuthority>map(role -> new SimpleGrantedAuthority("ROLE_" + role)).toList();
    }
}
