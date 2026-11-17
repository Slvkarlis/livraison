package com.fleetpulse.livraison.Repository;

import com.fleetpulse.livraison.Model.BaremeZone;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BaremeZoneRepository extends JpaRepository<BaremeZone, Long> {
    Optional<BaremeZone> findByZoneId(Long zoneId);
}
