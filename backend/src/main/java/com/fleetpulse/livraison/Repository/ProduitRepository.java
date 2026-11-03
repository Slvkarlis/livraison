package com.fleetpulse.livraison.Repository;
import com.fleetpulse.livraison.Model.Produit;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
public interface ProduitRepository extends JpaRepository<Produit, Long> {
    List<Produit> findAllByPartenaireIdOrderByIdAsc(Long partenaireId);
}
