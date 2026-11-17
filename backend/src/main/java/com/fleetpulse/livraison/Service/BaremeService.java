package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.FinanceDto.*;
import com.fleetpulse.livraison.Model.BaremeZone;
import com.fleetpulse.livraison.Model.Zone;
import com.fleetpulse.livraison.Model.enums.ActionAudit;
import com.fleetpulse.livraison.Repository.BaremeZoneRepository;
import com.fleetpulse.livraison.Repository.ZoneRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** US-512 : bareme de remuneration des coursiers par zone (base par mission + prix par km), defaut 3 DT + 0,5 DT/km. */
@Service @RequiredArgsConstructor @Transactional
public class BaremeService {
    private final BaremeZoneRepository baremes;
    private final ZoneRepository zones;
    private final AuditService audit;

    public record Bareme(BigDecimal base, BigDecimal parKm, boolean parDefaut) { }

    @Transactional(readOnly = true)
    public Bareme bareme(Long zoneId) {
        if (zoneId == null) return parDefaut();
        return baremes.findByZoneId(zoneId).map(b -> new Bareme(b.getBase(), b.getParKm(), false)).orElseGet(BaremeService::parDefaut);
    }

    /** Remuneration d'une mission livree depuis un commerce de cette zone. */
    @Transactional(readOnly = true)
    public BigDecimal remuneration(Long zoneId, double distanceKm) {
        Bareme b = bareme(zoneId);
        return CalculsFinanciers.remuneration(b.base(), b.parKm(), distanceKm);
    }

    @Transactional(readOnly = true)
    public List<BaremeVue> lister() {
        return zones.findAllByOrderByIdAsc().stream().map(this::vue).toList();
    }

    public BaremeVue definir(String email, Long zoneId, BaremeRequest r) {
        if (r == null) throw new IllegalArgumentException("Indiquez la base et le prix par km.");
        BigDecimal base = CalculsFinanciers.montantSaisi(r.base(), "Base par mission");
        BigDecimal parKm = CalculsFinanciers.montantSaisi(r.parKm(), "Prix par km");
        Zone zone = zones.findById(zoneId).orElseThrow(MarketplaceException::absent);
        BaremeZone b = baremes.findByZoneId(zoneId).orElseGet(BaremeZone::new);
        String avant = b.getBase() == null ? "défaut" : b.getBase().toPlainString() + " DT + " + b.getParKm().toPlainString() + " DT/km";
        b.setZone(zone);
        b.setBase(base);
        b.setParKm(parKm);
        b.setModifieLe(Instant.now().truncatedTo(ChronoUnit.MICROS));
        b.setModifiePar(email);
        baremes.save(b);
        audit.enregistrer(ActionAudit.BAREME_MODIFIE, "ZONE", zoneId,
                zone.getNom() + " : " + avant + " → " + base.toPlainString() + " DT + " + parKm.toPlainString() + " DT/km");
        return vue(zone);
    }

    private BaremeVue vue(Zone z) {
        return baremes.findByZoneId(z.getId())
                .map(b -> new BaremeVue(z.getId(), z.getNom(), b.getBase(), b.getParKm(), false, b.getModifieLe()))
                .orElseGet(() -> new BaremeVue(z.getId(), z.getNom(), CalculsFinanciers.BASE_PAR_DEFAUT, CalculsFinanciers.PAR_KM_PAR_DEFAUT, true, null));
    }

    private static Bareme parDefaut() {
        return new Bareme(CalculsFinanciers.BASE_PAR_DEFAUT, CalculsFinanciers.PAR_KM_PAR_DEFAUT, true);
    }
}
