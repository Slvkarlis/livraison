package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Model.enums.TypeAlerte;
import com.fleetpulse.livraison.Repository.BiRepository;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import static com.fleetpulse.livraison.Service.BiOperationsService.*;

/** Détection sur les agrégats réels, sans inventer d'historique de présence. */
@Component @RequiredArgsConstructor
public class DetectionAlertes {
    private final BiRepository agregats;
    public Map<Long, BigDecimal> detecter(TypeAlerte type, BigDecimal seuil, Instant maintenant) {
        Map<Long, BigDecimal> valeurs = new LinkedHashMap<>();
        List<Object[]> lignes = switch (type) {
            case CASH_COURSIER -> agregats.lignes("select f.livreur.id, sum(f.montantEncaisse) from FinanceCommande f where f.depot is null and f.livreur is not null group by f.livreur.id having sum(f.montantEncaisse) > :seuil", Map.of("seuil", seuil));
            case TAUX_REFUS_PARTENAIRE -> agregats.periode("""
                select c.partenaire.id, 100.0 * sum(case when c.motifRefus is not null then 1 else 0 end) /
                     sum(case when c.motifRefus is not null or c.accepteeLe is not null then 1 else 0 end)
                from Livraison c where c.partenaire is not null and c.dateCreation >= :depuis and c.dateCreation < :jusqua
                group by c.partenaire.id
                having sum(case when c.motifRefus is not null or c.accepteeLe is not null then 1 else 0 end) >= 5
                """, PeriodeBi.de(maintenant.atZone(ZoneId.of("Africa/Tunis")).toLocalDate().minusDays(6), maintenant.atZone(ZoneId.of("Africa/Tunis")).toLocalDate()), Map.of());
            case RETARD_ETA -> agregats.lignes("""
                select c.id, timestampdiff(second,c.promesseLivraison,:maintenant) / 60.0 from Livraison c
                where c.statut in ('ACCEPTEE','EN_PREPARATION','PRETE','AFFECTEE','RECUPEREE','A_PROXIMITE') and c.promesseLivraison < :limite
                """, Map.of("maintenant", maintenant, "limite", maintenant.minusMillis(seuil.multiply(new BigDecimal("60000")).longValue())));
            case ABSENCE_COURSIER -> agregats.lignes("""
                select c.partenaire.zone.id, min(c.preteLe) from Livraison c
                where c.statut = 'PRETE' and c.livreur is null and c.preteLe is not null and c.partenaire.zone is not null
                group by c.partenaire.zone.id
                """, Map.of());
            case COUVERTURE_ZONE -> List.of();
        };
        if (type == TypeAlerte.COUVERTURE_ZONE || type == TypeAlerte.ABSENCE_COURSIER) {
            Map<Long, Long> disponibles = comptes(agregats.disponibles(maintenant, null));
            if (type == TypeAlerte.COUVERTURE_ZONE) {
                comptes(agregats.commandesActives(null)).forEach((zone, actives) -> {
                    BigDecimal couverture = BigDecimal.valueOf(100.0 * disponibles.getOrDefault(zone, 0L) / actives);
                    if (couverture.compareTo(seuil) < 0) valeurs.put(zone, CalculsFinanciers.argent(couverture));
                });
            } else for (Object[] r : lignes) {
                long zone = nombre(r[0]);
                BigDecimal attente = BigDecimal.valueOf(Duration.between((Instant) r[1], maintenant).toMillis() / 60000.0);
                if (disponibles.getOrDefault(zone, 0L) == 0 && attente.compareTo(seuil) > 0) valeurs.put(zone, CalculsFinanciers.argent(attente));
            }
        } else for (Object[] r : lignes) {
            BigDecimal valeur = new BigDecimal(r[1].toString());
            if (valeur.compareTo(seuil) > 0) valeurs.put(nombre(r[0]), CalculsFinanciers.argent(valeur));
        }
        return valeurs;
    }
}
