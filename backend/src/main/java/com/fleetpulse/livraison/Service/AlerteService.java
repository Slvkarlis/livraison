package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.AlerteDto.*;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.*;
import com.fleetpulse.livraison.Repository.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @RequiredArgsConstructor @Transactional
public class AlerteService {
    private final SeuilAlerteRepository seuils;
    private final AlerteRepository alertes;
    private final DetectionAlertes detection;
    private final AuditService audit;

    @EventListener(ApplicationReadyEvent.class) @Order(-100)
    public void initialiser() {
        for (TypeAlerte type : TypeAlerte.values()) if (!seuils.existsById(type)) seuils.save(new SeuilAlerte(type));
    }

    @Transactional(readOnly = true)
    public List<SeuilVue> seuils(boolean finance) {
        return seuils.findByTypeInOrderByTypeAsc(types(finance)).stream().map(AlerteService::vue).toList();
    }

    public SeuilVue modifier(boolean finance, TypeAlerte type, DemandeSeuil r) {
        autoriser(finance, type);
        if (r == null || r.valeur() == null || r.actif() == null || r.valeur().signum() < 0
                || r.valeur().compareTo(type.maximum) > 0 || r.valeur().stripTrailingZeros().scale() > 3)
            throw new IllegalArgumentException("Seuil entre 0 et " + type.maximum + " " + type.unite + ", trois décimales maximum ; actif obligatoire.");
        SeuilAlerte s = seuils.verrouiller(type).orElseThrow(MarketplaceException::absent);
        String ancien = s.getValeur().toPlainString() + " (actif=" + s.isActif() + ")";
        s.setValeur(CalculsFinanciers.argent(r.valeur())); s.setActif(r.actif());
        audit.enregistrer(ActionAudit.SEUIL_ALERTE_MODIFIE, "SEUIL_ALERTE", null,
                type + " : " + ancien + " → " + s.getValeur().toPlainString() + " (actif=" + s.isActif() + ")");
        return vue(s);
    }

    /** Le verrou du seuil sérialise les évaluations et changements concurrents, y compris sur plusieurs instances. */
    public List<AlerteVue> actualiser(boolean finance) {
        Instant maintenant = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        for (TypeAlerte type : types(finance)) {
            SeuilAlerte s = seuils.verrouiller(type).orElseThrow(MarketplaceException::absent);
            Map<Long, BigDecimal> depassements = s.isActif() ? detection.detecter(type, s.getValeur(), maintenant) : Map.of();
            for (Alerte active : alertes.findByTypeAndActiveTrue(type)) if (!depassements.containsKey(active.getObjetId())) {
                active.setActive(false); active.setResolueLe(maintenant); active.setObserveeLe(maintenant);
            }
            depassements.forEach((objet, valeur) -> {
                Alerte a = alertes.findByTypeAndObjetId(type, objet).orElseGet(Alerte::new);
                if (!a.isActive()) a.setDeclencheeLe(maintenant);
                a.setType(type); a.setObjetId(objet); a.setActive(true); a.setValeur(valeur);
                a.setSeuil(s.getValeur()); a.setObserveeLe(maintenant); a.setResolueLe(null);
                alertes.save(a);
            });
        }
        return alertes.findByTypeInAndActiveTrueOrderByDeclencheeLeDescIdDesc(types(finance)).stream().map(a -> new AlerteVue(a.getId(), a.getType(),
                objet(a.getType()) + " #" + a.getObjetId(), a.getObjetId(), a.getValeur(), a.getSeuil(), a.getType().unite,
                a.getDeclencheeLe(), a.getObserveeLe())).toList();
    }

    private static List<TypeAlerte> types(boolean finance) { return Arrays.stream(TypeAlerte.values()).filter(t -> t.finance == finance).toList(); }
    private static void autoriser(boolean finance, TypeAlerte type) {
        if (type.finance != finance) throw new AccessDeniedException("Ce seuil relève de l'autre sous-rôle.");
    }
    private static SeuilVue vue(SeuilAlerte s) {
        TypeAlerte t = s.getType(); return new SeuilVue(t, t.libelle, t.unite, s.getValeur(), t.maximum, s.isActif());
    }
    private static String objet(TypeAlerte t) {
        return switch (t) { case CASH_COURSIER -> "Coursier"; case TAUX_REFUS_PARTENAIRE -> "Partenaire";
            case RETARD_ETA -> "Commande"; case COUVERTURE_ZONE, ABSENCE_COURSIER -> "Zone"; };
    }
}
