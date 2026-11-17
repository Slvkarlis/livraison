package com.fleetpulse.livraison.Repository;

import com.fleetpulse.livraison.Model.DepotCash;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DepotCashRepository extends JpaRepository<DepotCash, Long> {
    Optional<DepotCash> findByCleIdempotence(String cle);
    List<DepotCash> findAllByLivreurIdOrderByDateDescIdDesc(Long livreurId);
    List<DepotCash> findTop100ByOrderByDateDescIdDesc();
}
