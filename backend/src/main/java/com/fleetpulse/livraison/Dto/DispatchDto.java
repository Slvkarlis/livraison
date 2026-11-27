package com.fleetpulse.livraison.Dto;

import com.fleetpulse.livraison.Model.enums.StatutLivraison;
import com.fleetpulse.livraison.Model.enums.StatutLot;
import com.fleetpulse.livraison.Model.enums.StatutOffre;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** Sprint 4 : dispatch par lots (offres au coursier US-405, itineraire US-404, supervision US-407). */
public final class DispatchDto {
    private DispatchDto() { }

    /**
     * Arret de l'itineraire, dans l'ordre. type : COLLECTE (au commerce) ou LIVRAISON (au client).
     * Avant la collecte, le point de livraison est limite a la zone (minimisation des donnees) : latitude/longitude null.
     */
    public record EtapeVue(int ordre, Long commandeId, String codeSuivi, String type, String libelle,
                           Double latitude, Double longitude, Integer minutesDepuisDepart) { }

    /** Offre de lot en attente de reponse ; horsZone : coursier sollicite depuis une zone voisine (debordement). */
    public record OffreVue(Long id, Long lotId, Instant proposeeLe, Instant expireLe, boolean horsZone, Double distanceLivreurKm,
                           int nbCommandes, double distanceKm, int dureeMinutes, BigDecimal montantACollecter, List<EtapeVue> etapes, String source) {
        public OffreVue(Long id, Long lotId, Instant proposeeLe, Instant expireLe, boolean horsZone, Double distanceLivreurKm,
                        int nbCommandes, double distanceKm, int dureeMinutes, BigDecimal montantACollecter, List<EtapeVue> etapes) {
            this(id, lotId, proposeeLe, expireLe, horsZone, distanceLivreurKm, nbCommandes, distanceKm, dureeMinutes, montantACollecter, etapes, null);
        }
    }

    public record RefusOffreRequest(String motif) { }

    /** Lot accepte par le coursier : itineraire ordonne et commandes encore en cours. */
    public record LotVue(Long id, StatutLot statut, String source, String livreurPrenom, Instant accepteLe,
                         double distanceKm, int dureeMinutes, List<Long> commandes, List<EtapeVue> etapes) { }

    /** US-407 : affectation imposee par le responsable, motif obligatoire (audite). */
    public record ForcerRequest(Long livreurId, String motif) { }

    public record CycleVue(int offresExpirees, int offresProposees) { }

    public record OffreEnCoursVue(Long offreId, String livreurPrenom, Instant expireLe, boolean horsZone) { }

    /** alerte : en attente depuis plus que le delai maximal de recherche (US-402). */
    public record CommandeAttenteVue(Long id, String codeSuivi, String nomCommerce, String zoneNom, Instant preteLe,
                                     long minutesAttente, boolean alerte, Long lotId, OffreEnCoursVue offre) { }

    public record OffreHistoriqueVue(Long id, String livreurPrenom, StatutOffre statut, Instant proposeeLe, Instant reponduLe,
                                     boolean horsZone, double score, String motifRefus) { }

    public record CommandeLotVue(Long id, String codeSuivi, StatutLivraison statut) { }

    public record LotSupervisionVue(Long id, StatutLot statut, String source, String livreurPrenom, Instant creeLe, Instant accepteLe,
                                    double distanceKm, int dureeMinutes, List<CommandeLotVue> commandes, List<OffreHistoriqueVue> offres) { }

    public record LivreurSupervisionVue(Long id, String prenom, String nom, long missions, boolean offreEnCours,
                                        Double latitude, Double longitude, Instant dernierePositionLe) { }

    /** parLots false : affectation simple (Sprint 2 bis). ia : service d'IA configure (sinon regles). */
    public record SupervisionVue(Instant maintenant, boolean parLots, boolean ia, int delaiOffreSecondes, int delaiRechercheMaxMinutes,
                                 List<CommandeAttenteVue> enAttente, List<LotSupervisionVue> lots, List<LivreurSupervisionVue> livreurs) { }

    /** Carte du responsable : commerce geolocalise (les partenaires sans coordonnees sont omis). */
    public record PartenaireCarteVue(Long id, String nomCommerce, String categorie, String adresse, double latitude, double longitude,
                                     boolean ouvert, String zoneNom) {
        public static PartenaireCarteVue from(com.fleetpulse.livraison.Model.Partenaire p) {
            return new PartenaireCarteVue(p.getId(), p.getNomCommerce(), p.getCategorie(), p.getAdresse(), p.getLatitude(), p.getLongitude(),
                    Boolean.TRUE.equals(p.getOuvert()), p.getZone() == null ? null : p.getZone().getNom());
        }
    }
}
