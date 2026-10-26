package com.fleetpulse.livraison.Repository;

import com.fleetpulse.livraison.Model.CodeVerification;
import com.fleetpulse.livraison.Model.enums.TypeCode;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CodeVerificationRepository extends JpaRepository<CodeVerification, Long> {
    Optional<CodeVerification> findFirstByCibleAndTypeOrderByCreeLeDesc(String cible, TypeCode type);
}
