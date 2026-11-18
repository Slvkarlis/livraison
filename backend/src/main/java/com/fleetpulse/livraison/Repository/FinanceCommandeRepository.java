package com.fleetpulse.livraison.Repository;

import com.fleetpulse.livraison.Model.FinanceCommande;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FinanceCommandeRepository extends JpaRepository<FinanceCommande, Long> {
    @org.springframework.data.jpa.repository.Query("select coalesce(sum(f.montantEncaisse), 0) from FinanceCommande f where f.depot is null and f.livreur is not null and f.livreeLe >= :depuis and f.livreeLe < :jusqua")
    java.math.BigDecimal soldeBi(Instant depuis, Instant jusqua);
    Optional<FinanceCommande> findByCommandeId(Long commandeId);
    boolean existsByCommandeId(Long commandeId);
    // US-504 / US-505 : cash encore detenu par un coursier, et cash en circulation
    List<FinanceCommande> findAllByLivreurIdAndDepotIsNullOrderByLivreeLeAscIdAsc(Long livreurId);
    List<FinanceCommande> findAllByDepotIsNullAndLivreurIsNotNullOrderByLivreeLeAscIdAsc();
    List<FinanceCommande> findAllByDepotIdOrderByLivreeLeAscIdAsc(Long depotId);
    // US-506 : net a reverser (cash rapproche, pas encore reverse) ; US-512 : missions pas encore payees
    List<FinanceCommande> findAllByDepotIsNotNullAndClosingPartenaireIsNullAndLivreeLeBeforeOrderByIdAsc(Instant fin);
    List<FinanceCommande> findAllByClosingCoursierIsNullAndLivreurIsNotNullAndLivreeLeBeforeOrderByIdAsc(Instant fin);
    List<FinanceCommande> findAllByLivreurIdAndClosingCoursierIsNullOrderByLivreeLeAscIdAsc(Long livreurId);
}
