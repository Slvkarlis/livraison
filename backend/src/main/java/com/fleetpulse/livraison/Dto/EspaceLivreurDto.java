package com.fleetpulse.livraison.Dto;

import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.StatutLivraison;
import com.fleetpulse.livraison.Model.enums.TypeAffectation;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** Application coursier (US-2B8) : disponibilite et missions de collecte. */
public final class EspaceLivreurDto {
    private EspaceLivreurDto() { }

    /** latitude / longitude : obligatoires pour se declarer disponible. */
    public record DisponibiliteRequest(Boolean disponible, Double latitude, Double longitude) { }

    public record ZoneAutorisee(String nom, TypeAffectation type, boolean enVigueur) {
        public static ZoneAutorisee from(AffectationZone a, Instant maintenant) {
            return new ZoneAutorisee(a.getZone().getNom(), a.getType(), a.enVigueur(maintenant));
        }
    }

    public record DisponibiliteVue(boolean disponible, Instant miseAJourLe, List<ZoneAutorisee> zones) { }

    /** US-2B9 : contenu du QR scanne, ou code de collecte saisi a la main. */
    public record CollecteRequest(String code) { }

    /**
     * Mission : adresse du commerce ; du client, le prenom et la zone, puis l'adresse de livraison
     * une fois le colis collecte (minimisation : le coursier n'en a pas besoin avant).
     */
    public record MissionVue(Long id, String codeSuivi, StatutLivraison statut, String nomCommerce, String adresseCommerce,
                             Double latitudeCommerce, Double longitudeCommerce, String zoneNom, String clientPrenom,
                             int nbArticles, BigDecimal montantACollecter, Instant preteLe, Instant affecteeLe, Instant recupereeLe,
                             String adresseLivraison, Double latitudeLivraison, Double longitudeLivraison) {
        public static MissionVue from(Livraison c) {
            Partenaire p = c.getPartenaire();
            int nbArticles = c.getLignes().stream().mapToInt(LigneCommande::getQuantite).sum();
            boolean colisABord = c.getRecupereeLe() != null;
            return new MissionVue(c.getId(), c.getCodeSuivi(), c.getStatut(), p.getNomCommerce(), p.getAdresse(),
                    p.getLatitude(), p.getLongitude(), c.getNomZone(), c.getClient().getPrenom(), nbArticles, c.getTotal(),
                    c.getPreteLe(), c.getAffecteeLe(), c.getRecupereeLe(),
                    colisABord ? c.getAdresse() : null, colisABord ? c.getLatitude() : null, colisABord ? c.getLongitude() : null);
        }
    }

    /** US-301 : position envoyee par l'application pendant les missions. precision : metres (facultatif). */
    public record PositionRequest(Double latitude, Double longitude, Double precision) { }

    /** acceptee false : point ecarte (imprecis ou deplacement impossible), la derniere position reste valable. */
    public record PositionVue(boolean acceptee, String raison, Instant date, boolean enMission) { }
}
