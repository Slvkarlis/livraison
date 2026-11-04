package com.fleetpulse.livraison.Repository;

import com.fleetpulse.livraison.Model.Livraison;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LivraisonRepository extends JpaRepository<Livraison, Long> {
    Optional<Livraison> findByCleIdempotence(String cleIdempotence);
    long countByClientIdAndStatutIn(Long id, java.util.Collection<com.fleetpulse.livraison.Model.enums.StatutLivraison> statuts);
    Optional<Livraison> findFirstByClientIdOrderByDateCreationDesc(Long id);
    List<Livraison> findAllByOrderByDateCreationDesc();

    List<Livraison> findAllByClientEmailOrderByDateCreationDesc(String email);

}
