package com.fleetpulse.livraison.Model;

import jakarta.persistence.*;
import lombok.*;
import java.util.*;

@Entity @Getter @Setter @NoArgsConstructor
public class Client extends Utilisateur {
    @OneToMany(mappedBy = "client") private List<Livraison> livraisons = new ArrayList<>();
}
