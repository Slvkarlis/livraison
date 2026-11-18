package com.fleetpulse.livraison.Repository;

import com.fleetpulse.livraison.Service.PeriodeBi;
import jakarta.persistence.EntityManager;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

/** Projections agrégées en base : aucune collection de commandes chargée par un dashboard. */
@Repository @RequiredArgsConstructor
public class BiRepository {
    private final EntityManager em;

    public List<Object[]> ledger(PeriodeBi p) {
        return periode("select e.type, sum(e.montant) from EcritureLedger e where e.date >= :depuis and e.date < :jusqua group by e.type", p, Map.of());
    }

    public Object[] attentes(PeriodeBi p) {
        return periode("""
            select sum(case when f.depot is not null and f.closingPartenaire is null and f.partenaire is not null then f.netPartenaire else 0 end),
                   sum(case when f.closingCoursier is null and f.livreur is not null then f.remunerationCoursier else 0 end)
            from FinanceCommande f where f.livreeLe >= :depuis and f.livreeLe < :jusqua
            """, p, Map.of()).getFirst();
    }

    public long articles(PeriodeBi p) {
        var q = em.createQuery("select coalesce(sum(l.quantite), 0) from LigneCommande l where l.commande.statut = 'LIVREE' and l.commande.livreeLe >= :depuis and l.commande.livreeLe < :jusqua", Long.class);
        return q.setParameter("depuis", p.depuis()).setParameter("jusqua", p.jusqua()).getSingleResult();
    }

    public List<Object[]> periode(String hql, PeriodeBi periode, Map<String, Object> parametres) {
        Map<String, Object> valeurs = new LinkedHashMap<>(parametres);
        valeurs.put("depuis", periode.depuis()); valeurs.put("jusqua", periode.jusqua());
        return lignes(hql, valeurs);
    }

    public List<Object[]> lignes(String hql, Map<String, Object> valeurs) {
        var q = em.createQuery(hql, Object[].class);
        valeurs.forEach(q::setParameter);
        return q.getResultList();
    }
}
