package com.fleetpulse.livraison.Model;

import jakarta.persistence.*;
import lombok.*;

/** Commercant inscrit sur la marketplace ; son dossier est valide par le Responsable (US-104 / US-105). */
@Entity @Getter @Setter @NoArgsConstructor
public class Partenaire extends Utilisateur {
    private String nomCommerce;
    private String categorie;      // restaurant, boutique, alimentation...
    private String adresse;
    private Double latitude;
    private Double longitude;
    private String matriculeFiscal;
    @ManyToOne private Zone zone;
    private Boolean ouvert = false;
    // US-2B6 : horaires (minutes depuis minuit, heure de Tunis), jours ouverts (bit 0 = lundi), pause et expirations
    private Integer heureOuverture;
    private Integer heureFermeture;
    private int joursOuverts = 127;
    private java.time.Instant pauseJusqua;
    private int expirationsConsecutives;

    static final java.time.ZoneId FUSEAU_BOUTIQUE = java.time.ZoneId.of("Africa/Tunis");

    /** Vrai si le commerce peut recevoir une commande a cet instant : ouvert, hors pause, dans ses horaires. */
    public boolean accepteCommandes(java.time.Instant instant) {
        if (!Boolean.TRUE.equals(ouvert)) return false;
        if (pauseJusqua != null && instant.isBefore(pauseJusqua)) return false;
        if (heureOuverture == null || heureFermeture == null) return true;
        java.time.ZonedDateTime local = instant.atZone(FUSEAU_BOUTIQUE);
        if (((joursOuverts >> (local.getDayOfWeek().getValue() - 1)) & 1) == 0) return false;
        int minute = local.getHour() * 60 + local.getMinute();
        return heureOuverture <= heureFermeture
                ? minute >= heureOuverture && minute < heureFermeture
                : minute >= heureOuverture || minute < heureFermeture;
    }
}
