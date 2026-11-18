package com.fleetpulse.livraison.Repository;

import com.fleetpulse.livraison.Model.Alerte;
import com.fleetpulse.livraison.Model.enums.TypeAlerte;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AlerteRepository extends JpaRepository<Alerte, Long> {
    List<Alerte> findByTypeInAndActiveTrueOrderByDeclencheeLeDescIdDesc(Collection<TypeAlerte> types);
    List<Alerte> findByTypeAndActiveTrue(TypeAlerte type);
    Optional<Alerte> findByTypeAndObjetId(TypeAlerte type, Long objetId);
}
