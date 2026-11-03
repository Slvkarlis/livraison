package com.fleetpulse.livraison.Repository;
import com.fleetpulse.livraison.Model.Zone;
import java.util.List;
import org.springframework.data.jpa.repository.*;
public interface ZoneRepository extends JpaRepository<Zone, Long> {
    List<Zone> findAllByOrderByIdAsc();
    @Query("select z from Zone z where z.minLatitude <= :lat and z.maxLatitude >= :lat and z.minLongitude <= :lng and z.maxLongitude >= :lng order by z.id")
    List<Zone> candidates(double lat, double lng);
}
