package com.fleetpulse.livraison.Repository;

import com.fleetpulse.livraison.Model.PositionLivreur;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PositionLivreurRepository extends JpaRepository<PositionLivreur, Long> {
    List<PositionLivreur> findAllByLivreurIdOrderByDateAscIdAsc(Long livreurId);
}
