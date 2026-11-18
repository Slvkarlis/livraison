package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.BiDto.*;
import com.fleetpulse.livraison.Repository.BiRepository;
import java.time.temporal.ChronoUnit;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import static com.fleetpulse.livraison.Service.BiOperationsService.*;
import static com.fleetpulse.livraison.Service.BiPartenaireService.decimal;

@Service @RequiredArgsConstructor @Transactional(readOnly = true)
public class BiCoursierService {
    private final BiRepository agregats;
    public CoursiersVue dashboard(PeriodeBi p, Long zoneId) {
        validerZone(zoneId);
        Map<Long, Long> ecarts = comptes(agregats.ecartsDepot(p, zoneId));
        Map<Long, Object[]> notes = new HashMap<>();
        for (Object[] n : agregats.notesCoursiers(p, zoneId)) notes.put(nombre(n[0]), n);
        List<CoursierVue> coursiers = agregats.coursiers(p, zoneId).stream().map(r -> {
            long id = nombre(r[0]), eta = nombre(r[5]); double distance = ((Number) r[3]).doubleValue();
            Object[] note = notes.get(id);
            return new CoursierVue(id, nombre(r[1]), distance == 0 ? null : arrondir(((Number) r[2]).doubleValue() / distance),
                    nombre(r[4]), eta, nombre(r[6]), eta == 0 ? null : arrondir(100.0 * nombre(r[6]) / eta),
                    decimal(r[7]), nombre(r[8]), nombre(r[9]), ecarts.getOrDefault(id, 0L), note == null ? null : decimal(note[1]), note == null ? 0 : nombre(note[2]));
        }).toList();
        long jours = ChronoUnit.DAYS.between(p.debut(), p.fin()) + 1;
        List<ProductiviteZoneVue> zones = agregats.productivite(p, zoneId).stream().map(r -> {
            long livrees = nombre(r[2]), coursiersDistincts = nombre(r[3]);
            return new ProductiviteZoneVue(r[0] == null ? null : nombre(r[0]), r[1] == null ? "Zone non renseignée" : r[1].toString(),
                    livrees, coursiersDistincts, decimal(r[4]), arrondir(1.0 * livrees / jours),
                    coursiersDistincts == 0 ? null : arrondir(1.0 * livrees / coursiersDistincts));
        }).toList();
        return new CoursiersVue(p, coursiers, zones);
    }
}
