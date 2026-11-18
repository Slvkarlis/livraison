package com.fleetpulse.livraison.Repository;

import com.fleetpulse.livraison.Model.Notation;
import java.util.List;
import org.springframework.data.jpa.repository.*;

public interface NotationRepository extends JpaRepository<Notation, Long> {
    boolean existsByCommandeIdAndAuteurIdAndCibleId(Long commande, Long auteur, Long cible);
    @EntityGraph(attributePaths = "cible")
    List<Notation> findByCommandeIdAndAuteurIdOrderByIdAsc(Long commande, Long auteur);
    @Query("select avg(n.note) from Notation n where n.cible.id = :id")
    Double moyenne(Long id);
}
