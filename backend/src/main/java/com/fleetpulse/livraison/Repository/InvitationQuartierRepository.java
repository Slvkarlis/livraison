package com.fleetpulse.livraison.Repository;

import com.fleetpulse.livraison.Model.InvitationQuartier;
import java.time.Instant;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InvitationQuartierRepository extends JpaRepository<InvitationQuartier, Long> {
    long countByClientIdAndEnvoyeeLeGreaterThanEqualAndEnvoyeeLeLessThan(Long id, Instant debut, Instant fin);
    boolean existsByClientIdAndGroupeId(Long clientId, Long groupeId);
}
