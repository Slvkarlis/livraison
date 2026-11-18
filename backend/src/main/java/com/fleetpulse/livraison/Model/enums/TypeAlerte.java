package com.fleetpulse.livraison.Model.enums;

import java.math.BigDecimal;

public enum TypeAlerte {
    CASH_COURSIER("Cash détenu par coursier", "DT", "500", "1000000", true),
    TAUX_REFUS_PARTENAIRE("Refus partenaire sur 7 jours (au moins 5 décisions)", "%", "30", "100", false),
    RETARD_ETA("Dépassement de la promesse de livraison", "min", "10", "1440", false),
    COUVERTURE_ZONE("Couverture minimale des commandes actives", "%", "50", "100", false),
    ABSENCE_COURSIER("Attente sans coursier disponible", "min", "15", "1440", false);

    public final String libelle, unite;
    public final BigDecimal defaut, maximum;
    public final boolean finance;
    TypeAlerte(String libelle, String unite, String defaut, String maximum, boolean finance) {
        this.libelle = libelle; this.unite = unite; this.defaut = new BigDecimal(defaut);
        this.maximum = new BigDecimal(maximum); this.finance = finance;
    }
}
