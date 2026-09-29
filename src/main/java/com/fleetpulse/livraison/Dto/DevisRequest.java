package com.fleetpulse.livraison.Dto;

import com.fleetpulse.livraison.Model.enums.TypeLivraison;

public record DevisRequest(Double latitude, Double longitude, TypeLivraison typeLivraison) {
}
