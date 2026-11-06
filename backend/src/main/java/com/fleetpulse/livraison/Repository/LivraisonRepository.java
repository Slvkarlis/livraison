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

    // Serialise les decisions concurrentes sur une meme commande (double clic, deux appareils)
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select l from Livraison l where l.id = :id")
    Optional<Livraison> verrouiller(Long id);

    List<Livraison> findAllByPartenaireIdOrderByDateCreationDesc(Long partenaireId);
    List<Livraison> findAllByPartenaireIdAndStatutInOrderByDateCreationDesc(Long partenaireId,
            java.util.Collection<com.fleetpulse.livraison.Model.enums.StatutLivraison> statuts);

    // US-2B8 : missions d'un coursier et commandes pretes encore sans coursier
    List<Livraison> findAllByLivreurIdAndStatutInOrderByAffecteeLeAsc(Long livreurId,
            java.util.Collection<com.fleetpulse.livraison.Model.enums.StatutLivraison> statuts);
    long countByLivreurIdAndStatutIn(Long livreurId, java.util.Collection<com.fleetpulse.livraison.Model.enums.StatutLivraison> statuts);
    List<Livraison> findAllByStatutAndLivreurIsNullAndPartenaireZoneIdInOrderByPreteLeAsc(
            com.fleetpulse.livraison.Model.enums.StatutLivraison statut, java.util.Collection<Long> zoneIds);
}
