package com.fleetpulse.livraison.Repository;

import com.fleetpulse.livraison.Model.EvenementEntrepot;
import com.fleetpulse.livraison.Model.enums.TypeEvenement;
import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EvenementEntrepotRepository extends JpaRepository<EvenementEntrepot, Long> {
    List<EvenementEntrepot> findAllByDateGreaterThanEqualOrderByDateAscIdAsc(Instant depuis, Limit limite);
    List<EvenementEntrepot> findAllByTypeAndDateGreaterThanEqualOrderByDateAscIdAsc(TypeEvenement type, Instant depuis, Limit limite);
    List<EvenementEntrepot> findAllByCommandeIdOrderByDateAscIdAsc(Long commandeId);
    long countByType(TypeEvenement type);
}
