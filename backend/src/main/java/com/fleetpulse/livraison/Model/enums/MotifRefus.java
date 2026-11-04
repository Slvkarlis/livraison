package com.fleetpulse.livraison.Model.enums;

/** US-2B2 : motif obligatoire quand le partenaire refuse une commande. AUTRE exige un commentaire. */
public enum MotifRefus {
    RUPTURE("Rupture de stock"),
    FERMETURE("Commerce sur le point de fermer"),
    TROP_DE_COMMANDES("Trop de commandes en cours"),
    AUTRE("Autre");

    private final String libelle;
    MotifRefus(String libelle) { this.libelle = libelle; }
    public String libelle() { return libelle; }
}
