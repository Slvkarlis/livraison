package com.fleetpulse.livraison.Repository;

import com.fleetpulse.livraison.Model.PositionLivreur;
import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PositionLivreurRepository extends JpaRepository<PositionLivreur, Long> {
    List<PositionLivreur> findAllByLivreurIdOrderByDateAscIdAsc(Long livreurId);
    // US-401 : traces GPS exportees vers l'entrepot
    List<PositionLivreur> findAllByDateGreaterThanEqualOrderByDateAscIdAsc(Instant depuis, Limit limite);
}
