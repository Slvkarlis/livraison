package com.fleetpulse.livraison.Repository;

import com.fleetpulse.livraison.Model.SeuilAlerte;
import com.fleetpulse.livraison.Model.enums.TypeAlerte;
import jakarta.persistence.LockModeType;
import java.util.*;
import org.springframework.data.jpa.repository.*;

public interface SeuilAlerteRepository extends JpaRepository<SeuilAlerte, TypeAlerte> {
    List<SeuilAlerte> findByTypeInOrderByTypeAsc(Collection<TypeAlerte> types);
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select s from SeuilAlerte s where s.type = :type")
    Optional<SeuilAlerte> verrouiller(TypeAlerte type);
}
