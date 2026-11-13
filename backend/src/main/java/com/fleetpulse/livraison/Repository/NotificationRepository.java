package com.fleetpulse.livraison.Repository;

import com.fleetpulse.livraison.Model.Notification;
import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
    List<Notification> findAllByDestinataireIdOrderByCreeLeDescIdDesc(Long destinataireId, Pageable page);
    long countByDestinataireIdAndLueLeIsNull(Long destinataireId);

    @Modifying
    @Query("update Notification n set n.lueLe = :quand where n.destinataire.id = :destinataireId and n.lueLe is null")
    int marquerLues(Long destinataireId, Instant quand);
}
