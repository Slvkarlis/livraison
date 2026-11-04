package com.fleetpulse.livraison.Repository;

import com.fleetpulse.livraison.Model.HistoriqueStatut;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HistoriqueStatutRepository extends JpaRepository<HistoriqueStatut, Long> {
    List<HistoriqueStatut> findAllByCommandeIdOrderByDateAscIdAsc(Long commandeId);
}
