package com.fleetpulse.livraison.Repository;

import com.fleetpulse.livraison.Model.Livreur;
import com.fleetpulse.livraison.Model.enums.StatutCompte;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LivreurRepository extends JpaRepository<Livreur, Long> {
    List<Livreur> findAllByStatutInOrderByNomAscPrenomAsc(Collection<StatutCompte> statuts);
}
