package com.fleetpulse.livraison.Model;

import jakarta.persistence.*;
import lombok.*;
import java.util.*;

@Entity @Getter @Setter @NoArgsConstructor
public class Client extends Utilisateur {
    @Column(columnDefinition = "boolean default true") private Boolean recevoirInvitationsQuartier = true;
    public boolean invitationsQuartierActives() { return !Boolean.FALSE.equals(recevoirInvitationsQuartier); }
    @OneToMany(mappedBy = "client") private List<Livraison> livraisons = new ArrayList<>();
    @OneToMany(mappedBy = "client") private List<AdresseLivraison> adresses = new ArrayList<>();
    @Transient public int getNbCommandes() { return livraisons.size(); }
    public void passerCommande(Livraison commande) { commande.setClient(this); livraisons.add(commande); }
}
