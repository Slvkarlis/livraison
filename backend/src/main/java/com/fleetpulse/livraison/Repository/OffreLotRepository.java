package com.fleetpulse.livraison.Repository;

import com.fleetpulse.livraison.Model.OffreLot;
import com.fleetpulse.livraison.Model.enums.StatutOffre;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface OffreLotRepository extends JpaRepository<OffreLot, Long> {
    List<OffreLot> findAllByStatutAndExpireLeBeforeOrderByIdAsc(StatutOffre statut, Instant date);
    List<OffreLot> findAllByLivreurIdAndStatutOrderByIdAsc(Long livreurId, StatutOffre statut);
    List<OffreLot> findAllByLotIdAndStatut(Long lotId, StatutOffre statut);
    List<OffreLot> findAllByLotIdInOrderByIdAsc(Collection<Long> lotIds);
    List<OffreLot> findAllByStatutOrderByIdAsc(StatutOffre statut);
    boolean existsByLivreurIdAndStatut(Long livreurId, StatutOffre statut);

    @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from OffreLot o where o.id = :id")
    Optional<OffreLot> verrouiller(Long id);
}
