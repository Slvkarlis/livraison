package com.fleetpulse.livraison.Repository;

import com.fleetpulse.livraison.Model.JetonRafraichissement;
import com.fleetpulse.livraison.Model.Utilisateur;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface JetonRafraichissementRepository extends JpaRepository<JetonRafraichissement, Long> {
    Optional<JetonRafraichissement> findByJetonHash(String jetonHash);

    @Modifying
    @Query("update JetonRafraichissement j set j.revoque = true where j.utilisateur = :utilisateur and j.revoque = false")
    int revoquerTous(Utilisateur utilisateur);
}
