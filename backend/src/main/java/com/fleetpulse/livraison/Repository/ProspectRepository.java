package com.fleetpulse.livraison.Repository;

import com.fleetpulse.livraison.Model.Prospect;
import com.fleetpulse.livraison.Model.enums.StatutProspect;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProspectRepository extends JpaRepository<Prospect, Long> {
    List<Prospect> findAllByOrderByScoreDescIdAsc();
    List<Prospect> findAllByStatutOrderByScoreDescIdAsc(StatutProspect statut);
    List<Prospect> findAllByStatutInOrderByStatutLeDesc(List<StatutProspect> statuts);
}
