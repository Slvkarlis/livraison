package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.BiDto.*;
import com.fleetpulse.livraison.Model.enums.StatutLivraison;
import com.fleetpulse.livraison.Repository.BiRepository;
import java.time.Instant;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @RequiredArgsConstructor @Transactional(readOnly = true)
public class BiOperationsService {
    private final BiRepository agregats;
    public OperationsVue dashboard(PeriodeBi p, Long zoneId) {
        validerZone(zoneId);
        Instant maintenant = Instant.now();
        Map<Long, Long> disponibles = comptes(agregats.disponibles(maintenant, zoneId));
        Map<Long, Long> actives = comptes(agregats.commandesActives(zoneId));
        Map<StatutLivraison, Long> statuts = new EnumMap<>(StatutLivraison.class);
        for (Object[] r : agregats.statuts(p, zoneId)) statuts.put((StatutLivraison) r[0], nombre(r[1]));
        List<ZoneVue> zones = agregats.zones(p, zoneId).stream().map(r -> {
            Long id = ((Number) r[0]).longValue(); long a = actives.getOrDefault(id, 0L), d = disponibles.getOrDefault(id, 0L);
            return new ZoneVue(id, (String) r[1], ((Number) r[2]).doubleValue(), ((Number) r[3]).doubleValue(),
                    nombre(r[4]), nombre(r[5]), a, d, a == 0 ? null : arrondir(100.0 * d / a));
        }).toList();
        return new OperationsVue(p, maintenant, Arrays.stream(StatutLivraison.values()).map(s -> new StatutVue(s, statuts.getOrDefault(s, 0L))).toList(), zones,
                null, null, "Aucun scénario de dispatch unitaire de référence n'est conservé avec le lot.");
    }
    public static long nombre(Object v) { return v == null ? 0 : ((Number) v).longValue(); }
    public static Double arrondir(double v) { return Math.round(v * 1000) / 1000.0; }
    public static void validerZone(Long id) { if (id != null && id < 1) throw new IllegalArgumentException("Zone invalide."); }
    public static Map<Long, Long> comptes(List<Object[]> lignes) {
        Map<Long, Long> m = new HashMap<>();
        for (Object[] r : lignes) if (r[0] != null) m.put(((Number) r[0]).longValue(), nombre(r[1]));
        return m;
    }
}
