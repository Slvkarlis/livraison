package com.fleetpulse.livraison.Repository;
import com.fleetpulse.livraison.Model.Client;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.*;
public interface ClientRepository extends JpaRepository<Client, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select c from Client c where c.email = :email")
    Optional<Client> verrouiller(String email);
}
