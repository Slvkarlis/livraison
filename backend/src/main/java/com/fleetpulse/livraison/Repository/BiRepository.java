package com.fleetpulse.livraison.Repository;

import com.fleetpulse.livraison.Service.PeriodeBi;
import jakarta.persistence.EntityManager;
import java.time.Instant;
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

    public List<Object[]> statuts(PeriodeBi p, Long zoneId) {
        return periode("select c.statut, count(c.id) from Livraison c left join c.partenaire p where c.dateCreation >= :depuis and c.dateCreation < :jusqua"
                + zone("p.zone.id", zoneId) + " group by c.statut", p, filtreZone(zoneId));
    }

    public List<Object[]> zones(PeriodeBi p, Long zoneId) {
        return periode("""
            select z.id, z.nom, (z.minLatitude + z.maxLatitude) / 2, (z.minLongitude + z.maxLongitude) / 2,
                   count(c.id), sum(case when c.statut = 'LIVREE' then 1 else 0 end)
            from Zone z left join Partenaire partenaire on partenaire.zone = z
            left join Livraison c on c.partenaire = partenaire and c.dateCreation >= :depuis and c.dateCreation < :jusqua
            where 1 = 1
            """ + zone("z.id", zoneId) + " group by z.id, z.nom, z.minLatitude, z.maxLatitude, z.minLongitude, z.maxLongitude order by z.id", p, filtreZone(zoneId));
    }

    public List<Object[]> commandesActives(Long zoneId) {
        return lignes("select c.partenaire.zone.id, count(c.id) from Livraison c where c.statut not in ('LIVREE', 'REFUSEE', 'ANNULEE', 'ECHEC', 'RETOURNEE')"
                + zone("c.partenaire.zone.id", zoneId) + " group by c.partenaire.zone.id", filtreZone(zoneId));
    }

    public List<Object[]> disponibles(Instant maintenant, Long zoneId) {
        Map<String, Object> params = new LinkedHashMap<>(filtreZone(zoneId)); params.put("maintenant", maintenant);
        return lignes("""
            select a.zone.id, count(distinct a.livreur.id) from AffectationZone a
            where a.livreur.disponible = true and a.livreur.statut = 'ACTIF'
              and (a.type <> 'TEMPORAIRE' or (a.debut <= :maintenant and a.fin > :maintenant))
            """ + zone("a.zone.id", zoneId) + " group by a.zone.id", params);
    }

    public static String zone(String champ, Long id) { return id == null ? "" : " and " + champ + " = :zoneId"; }
    public static Map<String, Object> filtreZone(Long id) { return id == null ? Map.of() : Map.of("zoneId", id); }

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
