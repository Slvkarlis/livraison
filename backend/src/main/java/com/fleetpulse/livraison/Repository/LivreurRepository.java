package com.fleetpulse.livraison.Repository;

import com.fleetpulse.livraison.Model.Livreur;
import com.fleetpulse.livraison.Model.enums.StatutCompte;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LivreurRepository extends JpaRepository<Livreur, Long> {
    List<Livreur> findAllByStatutInOrderByNomAscPrenomAsc(Collection<StatutCompte> statuts);
    Optional<Livreur> findByEmail(String email);

    // US-505 : deux depots simultanes pour un meme coursier sont serialises
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select l from Livreur l where l.id = :id")
    Optional<Livreur> verrouiller(Long id);
}
