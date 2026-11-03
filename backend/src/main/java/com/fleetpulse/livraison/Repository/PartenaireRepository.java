package com.fleetpulse.livraison.Repository;
import com.fleetpulse.livraison.Model.Partenaire;
import jakarta.persistence.LockModeType;
import java.util.*;
import org.springframework.data.jpa.repository.*;
public interface PartenaireRepository extends JpaRepository<Partenaire, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select p from Partenaire p where p.email = :email")
    Optional<Partenaire> verrouillerEmail(String email);
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select p from Partenaire p where p.id = :id")
    Optional<Partenaire> verrouiller(Long id);
}
