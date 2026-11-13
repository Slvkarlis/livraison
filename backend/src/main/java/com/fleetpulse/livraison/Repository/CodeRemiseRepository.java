package com.fleetpulse.livraison.Repository;

import com.fleetpulse.livraison.Model.CodeRemise;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CodeRemiseRepository extends JpaRepository<CodeRemise, Long> {
    Optional<CodeRemise> findByCommandeId(Long commandeId);
}
