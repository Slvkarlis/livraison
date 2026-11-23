package com.fleetpulse.livraison.Repository;

import com.fleetpulse.livraison.Model.Reclamation;
import com.fleetpulse.livraison.Model.enums.StatutReclamation;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReclamationRepository extends JpaRepository<Reclamation, Long> {
    Optional<Reclamation> findByCommandeId(Long commandeId);
    List<Reclamation> findAllByCommandeClientEmailOrderByCreeeLeDesc(String email);
    List<Reclamation> findAllByStatutOrderByCreeeLeAsc(StatutReclamation statut);
    List<Reclamation> findAllByOrderByCreeeLeDesc();
}
