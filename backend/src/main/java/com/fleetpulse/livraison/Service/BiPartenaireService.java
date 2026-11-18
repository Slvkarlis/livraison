package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.BiDto.*;
import com.fleetpulse.livraison.Repository.BiRepository;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import static com.fleetpulse.livraison.Service.BiOperationsService.*;

@Service @RequiredArgsConstructor @Transactional(readOnly = true)
public class BiPartenaireService {
    private final BiRepository agregats;
    public PartenairesVue dashboard(PeriodeBi p, Long zoneId) {
        validerZone(zoneId);
        Map<Long, Object[]> notes = new HashMap<>();
        for (Object[] r : agregats.notesPartenaires(p, zoneId)) notes.put(nombre(r[0]), r);
        List<Long> classement = notes.values().stream().sorted(Comparator.<Object[]>comparingDouble(r -> ((Number) r[1]).doubleValue()).reversed()
                .thenComparing(Comparator.<Object[]>comparingLong(r -> nombre(r[2])).reversed()).thenComparingLong(r -> nombre(r[0])))
                .map(r -> nombre(r[0])).toList();
        Map<Long, List<MotifVue>> motifs = new HashMap<>();
        for (Object[] r : agregats.motifs(p, zoneId)) motifs.computeIfAbsent(nombre(r[0]), k -> new ArrayList<>()).add(new MotifVue(r[1].toString(), nombre(r[2])));
        List<PartenaireVue> partenaires = agregats.partenaires(p, zoneId).stream().map(r -> {
            long id = nombre(r[0]), accepte = nombre(r[3]), refuse = nombre(r[4]), decisions = accepte + refuse;
            Object[] note = notes.get(id);
            return new PartenaireVue(id, (String) r[1], nombre(r[2]), accepte, refuse,
                    decisions == 0 ? null : arrondir(accepte * 100.0 / decisions), decisions == 0 ? null : arrondir(refuse * 100.0 / decisions),
                    decimal(r[5]), decimal(r[6]), nombre(r[7]), note == null ? null : decimal(note[1]), note == null ? 0 : nombre(note[2]),
                    note == null ? null : classement.indexOf(id) + 1, motifs.getOrDefault(id, List.of()), null, null);
        }).sorted(Comparator.comparing(PartenaireVue::classement, Comparator.nullsLast(Comparator.naturalOrder())).thenComparing(PartenaireVue::id)).toList();
        return new PartenairesVue(p, partenaires);
    }
    public static Double decimal(Object v) { return v == null ? null : arrondir(((Number) v).doubleValue()); }
}
