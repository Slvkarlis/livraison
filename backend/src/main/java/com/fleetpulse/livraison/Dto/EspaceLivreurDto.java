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

    /** Mission de collecte : adresse du commerce ; du client, seulement le prenom et la zone (livraison au Sprint 3). */
    public record MissionVue(Long id, String codeSuivi, StatutLivraison statut, String nomCommerce, String adresseCommerce,
                             Double latitudeCommerce, Double longitudeCommerce, String zoneNom, String clientPrenom,
                             int nbArticles, BigDecimal montantACollecter, Instant preteLe, Instant affecteeLe) {
        public static MissionVue from(Livraison c) {
            Partenaire p = c.getPartenaire();
            int nbArticles = c.getLignes().stream().mapToInt(LigneCommande::getQuantite).sum();
            return new MissionVue(c.getId(), c.getCodeSuivi(), c.getStatut(), p.getNomCommerce(), p.getAdresse(),
                    p.getLatitude(), p.getLongitude(), c.getNomZone(), c.getClient().getPrenom(), nbArticles, c.getTotal(),
                    c.getPreteLe(), c.getAffecteeLe());
        }
    }
}
