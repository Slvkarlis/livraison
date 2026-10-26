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
}
