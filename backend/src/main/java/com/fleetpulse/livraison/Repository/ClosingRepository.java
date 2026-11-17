package com.fleetpulse.livraison.Repository;

import com.fleetpulse.livraison.Model.Closing;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ClosingRepository extends JpaRepository<Closing, Long> {
    Optional<Closing> findBySemaine(LocalDate semaine);
    List<Closing> findAllByOrderBySemaineDesc();
}
