package com.fleetpulse.livraison.Dto;

import com.fleetpulse.livraison.Model.Livreur;
import com.fleetpulse.livraison.Model.Utilisateur;
import com.fleetpulse.livraison.Model.enums.Role;

/** Profil de l'utilisateur connecte, utilise par les applications mobiles. */
public record ProfilResponse(
        Long id,
        String nom,
        String prenom,
        String email,
        String telephone,
        Role role,
        VehiculeResponse vehicule) {

    public static ProfilResponse from(Utilisateur utilisateur) {
        VehiculeResponse vehicule = utilisateur instanceof Livreur livreur && livreur.getVehicule() != null
                ? VehiculeResponse.from(livreur.getVehicule()) : null;
        return new ProfilResponse(
                utilisateur.getId(), utilisateur.getNom(), utilisateur.getPrenom(), utilisateur.getEmail(),
                utilisateur.getTelephone(), utilisateur.getRole(), vehicule);
    }
}
