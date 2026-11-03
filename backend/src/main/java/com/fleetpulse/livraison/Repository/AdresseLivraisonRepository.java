package com.fleetpulse.livraison.Repository;
import com.fleetpulse.livraison.Model.AdresseLivraison;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
public interface AdresseLivraisonRepository extends JpaRepository<AdresseLivraison, Long> {
    List<AdresseLivraison> findAllByClientEmailOrderByIdAsc(String email);
    long countByClientId(Long id);
}
