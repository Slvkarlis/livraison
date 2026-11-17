package com.fleetpulse.livraison.Dto;

import com.fleetpulse.livraison.Model.EvenementEntrepot;
import com.fleetpulse.livraison.Model.enums.TypeEvenement;
import java.time.Instant;
import java.util.List;

/** US-401 : lecture de l'entrepot de donnees et jeux d'entrainement des modeles (service d'IA). */
public final class EntrepotDto {
    private EntrepotDto() { }

    public record EvenementVue(Long id, TypeEvenement type, Instant date, Long commandeId, Long livreurId, Long zoneId, Long lotId,
                               Double valeur, String code, String details) {
        public static EvenementVue from(EvenementEntrepot e) {
            return new EvenementVue(e.getId(), e.getType(), e.getDate(), e.getCommandeId(), e.getLivreurId(), e.getZoneId(), e.getLotId(),
                    e.getValeur(), e.getCode(), e.getDetails());
        }
    }

    /**
     * Commande livree vue par le modele d'ETA : caracteristiques connues a l'acceptation et durees reelles.
     * heure, jourSemaine : heure de Tunisie (1 = lundi). Durees en minutes, null si l'etape manque.
     */
    public record EchantillonEta(Long commandeId, Long partenaireId, Long zoneId, int heure, int jourSemaine,
                                 Integer preparationAnnonceeMin, Double preparationReelleMin, double distanceKm, double vitesseZoneKmh,
                                 int tailleLot, Double attenteCollecteMin, Double trajetReelMin) { }

    public record TraceVue(Long livreurId, double latitude, double longitude, Double precisionMetres, Instant date) { }

    public record ZoneExport(Long id, String nom, double vitesseMoyenneKmh, List<Long> voisines) { }

    public record ExportEntrepot(Instant genereLe, Instant depuis, List<EvenementVue> evenements, List<EchantillonEta> eta,
                                 List<TraceVue> traces, List<ZoneExport> zones) { }
}
