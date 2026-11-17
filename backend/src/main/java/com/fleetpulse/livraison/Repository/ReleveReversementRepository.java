package com.fleetpulse.livraison.Repository;

import com.fleetpulse.livraison.Model.ReleveReversement;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReleveReversementRepository extends JpaRepository<ReleveReversement, Long> {
    List<ReleveReversement> findAllByClosingIdOrderByIdAsc(Long closingId);
    List<ReleveReversement> findAllByPartenaireIdOrderByIdDesc(Long partenaireId);
}
