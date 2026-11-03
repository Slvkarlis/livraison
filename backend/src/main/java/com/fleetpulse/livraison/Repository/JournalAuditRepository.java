package com.fleetpulse.livraison.Repository;

import com.fleetpulse.livraison.Model.JournalAudit;
import com.fleetpulse.livraison.Model.enums.ActionAudit;
import java.util.List;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface JournalAuditRepository extends JpaRepository<JournalAudit, Long>, JpaSpecificationExecutor<JournalAudit> {
    @Query("""
            select j from JournalAudit j
            where (:acteur is null or j.acteur = :acteur)
              and (:action is null or j.action = :action)
              and (:cibleId is null or j.cibleId = :cibleId)
            order by j.date desc, j.id desc""")
    List<JournalAudit> rechercher(String acteur, ActionAudit action, Long cibleId, Limit limit);
}
