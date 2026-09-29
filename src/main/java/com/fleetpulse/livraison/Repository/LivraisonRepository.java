package com.fleetpulse.livraison.Repository;

import com.fleetpulse.livraison.Model.Livraison;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LivraisonRepository extends JpaRepository<Livraison, Long> {
    List<Livraison> findAllByOrderByDateCreationDesc();

    List<Livraison> findAllByClientEmailOrderByDateCreationDesc(String email);
}
