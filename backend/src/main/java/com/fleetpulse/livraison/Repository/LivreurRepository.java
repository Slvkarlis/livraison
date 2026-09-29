package com.fleetpulse.livraison.Repository;

import com.fleetpulse.livraison.Model.Livreur;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LivreurRepository extends JpaRepository<Livreur, Long> {
    List<Livreur> findAllByOrderByNomAscPrenomAsc();
}
