package com.fleetpulse.livraison.Repository;

import com.fleetpulse.livraison.Model.AffectationZone;
import com.fleetpulse.livraison.Model.enums.TypeAffectation;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AffectationZoneRepository extends JpaRepository<AffectationZone, Long> {
    List<AffectationZone> findAllByLivreurIdOrderByTypeAscIdAsc(Long livreurId);
    List<AffectationZone> findAllByType(TypeAffectation type);
    boolean existsByLivreurIdAndZoneId(Long livreurId, Long zoneId);
    boolean existsByLivreurIdAndType(Long livreurId, TypeAffectation type);
    boolean existsByZoneId(Long zoneId);
}
