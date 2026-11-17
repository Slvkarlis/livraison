package com.fleetpulse.livraison.Repository;

import com.fleetpulse.livraison.Model.TauxCommission;
import com.fleetpulse.livraison.Model.enums.PorteeCommission;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TauxCommissionRepository extends JpaRepository<TauxCommission, Long> {
    Optional<TauxCommission> findFirstByPortee(PorteeCommission portee);
    Optional<TauxCommission> findFirstByPorteeAndCategorie(PorteeCommission portee, String categorie);
    Optional<TauxCommission> findFirstByPorteeAndPartenaireId(PorteeCommission portee, Long partenaireId);
    List<TauxCommission> findAllByOrderByPorteeAscIdAsc();
}
