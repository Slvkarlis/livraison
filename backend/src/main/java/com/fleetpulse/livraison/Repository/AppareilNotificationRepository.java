package com.fleetpulse.livraison.Repository;

import com.fleetpulse.livraison.Model.AppareilNotification;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AppareilNotificationRepository extends JpaRepository<AppareilNotification, Long> {
    Optional<AppareilNotification> findByJeton(String jeton);
    List<AppareilNotification> findAllByUtilisateurId(Long utilisateurId);
}
