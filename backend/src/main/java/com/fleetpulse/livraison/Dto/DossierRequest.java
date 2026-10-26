package com.fleetpulse.livraison.Dto;

/** Correction d'un dossier par son auteur : seuls les champs non nuls sont modifies. */
public record DossierRequest(
        String nom,
        String prenom,
        String telephone,
        String nomCommerce,
        String categorie,
        String adresse,
        Double latitude,
        Double longitude,
        String matriculeFiscal,
        String numeroIdentite,
        String vehiculeDeclare) {
}
