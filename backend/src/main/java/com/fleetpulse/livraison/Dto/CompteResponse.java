package com.fleetpulse.livraison.Dto;

import com.fleetpulse.livraison.Model.Livreur;
import com.fleetpulse.livraison.Model.Partenaire;
import com.fleetpulse.livraison.Model.Responsable;
import com.fleetpulse.livraison.Model.Utilisateur;
import com.fleetpulse.livraison.Model.enums.Role;
import com.fleetpulse.livraison.Model.enums.SousRole;
import com.fleetpulse.livraison.Model.enums.StatutCompte;
import java.time.Instant;

/** Compte et dossier d'un utilisateur, vu par le Responsable ou par le candidat lui-meme. */
public record CompteResponse(
        Long id,
        Role role,
        StatutCompte statut,
        String motifStatut,
        String nom,
        String prenom,
        String email,
        String telephone,
        boolean telephoneVerifie,
        Instant dateCreation,
        SousRole sousRole,
        String nomCommerce,
        String categorie,
        String adresse,
        Double latitude,
        Double longitude,
        String matriculeFiscal,
        String numeroIdentite,
        String vehiculeDeclare) {

    public static CompteResponse from(Utilisateur u) {
        Partenaire p = u instanceof Partenaire partenaire ? partenaire : null;
        Livreur l = u instanceof Livreur livreur ? livreur : null;
        return new CompteResponse(
                u.getId(), u.getRole(), u.getStatut(), u.getMotifStatut(), u.getNom(), u.getPrenom(), u.getEmail(),
                u.getTelephone(), u.isTelephoneVerifie(), u.getDateCreation(),
                u instanceof Responsable r ? r.getSousRole() : null,
                p == null ? null : p.getNomCommerce(), p == null ? null : p.getCategorie(),
                p == null ? null : p.getAdresse(), p == null ? null : p.getLatitude(),
                p == null ? null : p.getLongitude(), p == null ? null : p.getMatriculeFiscal(),
                l == null ? null : l.getNumeroIdentite(), l == null ? null : l.getVehiculeDeclare());
    }
}
