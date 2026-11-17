package com.fleetpulse.livraison.Repository;

import com.fleetpulse.livraison.Model.ReleveCoursier;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReleveCoursierRepository extends JpaRepository<ReleveCoursier, Long> {
    List<ReleveCoursier> findAllByClosingIdOrderByIdAsc(Long closingId);
    List<ReleveCoursier> findAllByLivreurIdOrderByIdDesc(Long livreurId);
}
