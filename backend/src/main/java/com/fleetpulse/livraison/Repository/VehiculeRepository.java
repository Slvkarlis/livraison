package com.fleetpulse.livraison.Repository;

import com.fleetpulse.livraison.Model.Vehicule;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VehiculeRepository extends JpaRepository<Vehicule, Long> {
    List<Vehicule> findAllByOrderByImmatriculationAsc();
}
