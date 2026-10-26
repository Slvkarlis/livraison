package com.fleetpulse.livraison.Dto;

import com.fleetpulse.livraison.Model.enums.SousRole;

public record CreateResponsableRequest(
        String nom,
        String prenom,
        String email,
        String telephone,
        String motDePasse,
        SousRole sousRole) {
}
