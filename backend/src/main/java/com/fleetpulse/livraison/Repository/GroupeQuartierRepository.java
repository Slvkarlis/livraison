package com.fleetpulse.livraison.Repository;

import com.fleetpulse.livraison.Model.GroupeQuartier;
import com.fleetpulse.livraison.Model.enums.StatutGroupeQuartier;
import jakarta.persistence.LockModeType;
import java.util.*;
import org.springframework.data.jpa.repository.*;

public interface GroupeQuartierRepository extends JpaRepository<GroupeQuartier, Long> {
    List<GroupeQuartier> findAllByStatutOrderByOuvertureAsc(StatutGroupeQuartier statut);
    List<GroupeQuartier> findAllByCommerceIdAndStatutOrderByOuvertureAsc(Long commerceId, StatutGroupeQuartier statut);
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select g from GroupeQuartier g where g.id = :id")
    Optional<GroupeQuartier> verrouiller(Long id);
}
