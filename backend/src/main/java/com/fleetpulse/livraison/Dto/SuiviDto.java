package com.fleetpulse.livraison.Dto;

import com.fleetpulse.livraison.Dto.MarketplaceDto.Position;
import com.fleetpulse.livraison.Model.enums.StatutLivraison;
import java.time.Instant;

/** US-302 / US-303 : suivi de sa commande par le client. */
public final class SuiviDto {
    private SuiviDto() { }

    public record PositionLivreurVue(double latitude, double longitude, Instant date) { }

    /**
     * livreur : seulement une fois le colis a bord (minimisation des donnees de position).
     * arriveeEstimee : ETA par regles, null quand la commande n'est pas en cours de livraison.
     */
    public record SuiviCommandeVue(Long commandeId, StatutLivraison statut, String livreurPrenom, PositionLivreurVue livreur,
                                   Position commerce, Position destination, Instant pretePrevueLe, Instant arriveeEstimee) { }

    /** Message temps reel /user/queue/positions, envoye au client a chaque position retenue du coursier. */
    public record PositionCommande(Long commandeId, double latitude, double longitude, Instant date, Instant arriveeEstimee) { }
}
