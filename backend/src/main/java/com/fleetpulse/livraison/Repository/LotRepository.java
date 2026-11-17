package com.fleetpulse.livraison.Repository;

import com.fleetpulse.livraison.Model.Lot;
import com.fleetpulse.livraison.Model.enums.StatutLot;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface LotRepository extends JpaRepository<Lot, Long> {
    List<Lot> findAllByStatutOrderByIdAsc(StatutLot statut);
    List<Lot> findAllByStatutInOrderByIdDesc(Collection<StatutLot> statuts);
    List<Lot> findAllByLivreurIdAndStatutOrderByAccepteLeAsc(Long livreurId, StatutLot statut);

    // Un lot est pris par un seul coursier : acceptation, refus et expiration sont serialises
    @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select l from Lot l where l.id = :id")
    Optional<Lot> verrouiller(Long id);
}
