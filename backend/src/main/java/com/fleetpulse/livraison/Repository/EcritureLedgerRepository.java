package com.fleetpulse.livraison.Repository;

import com.fleetpulse.livraison.Model.EcritureLedger;
import com.fleetpulse.livraison.Model.enums.TypeEcriture;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface EcritureLedgerRepository extends JpaRepository<EcritureLedger, Long>, JpaSpecificationExecutor<EcritureLedger> {
    List<EcritureLedger> findAllByCommandeIdOrderByIdAsc(Long commandeId);
    List<EcritureLedger> findAllByLivreurIdAndTypeOrderByIdAsc(Long livreurId, TypeEcriture type);
}
