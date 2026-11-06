package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.AffectationZoneDto.*;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.ActionAudit;
import com.fleetpulse.livraison.Model.enums.TypeAffectation;
import com.fleetpulse.livraison.Repository.*;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * US-2B11 : le Responsable rattache chaque coursier a ses zones.
 * Regles : une seule zone principale par coursier, une zone au plus une fois par coursier,
 * une affectation temporaire a un debut et une fin dans le futur.
 */
@Service @RequiredArgsConstructor @Transactional
public class AffectationZoneService {
    private final AffectationZoneRepository affectations;
    private final LivreurRepository livreurs;
    private final ZoneRepository zones;
    private final AuditService audit;

    @Transactional(readOnly = true)
    public List<AffectationVue> lister(Long livreurId) {
        livreur(livreurId);
        Instant maintenant = Instant.now();
        return affectations.findAllByLivreurIdOrderByTypeAscIdAsc(livreurId).stream()
                .map(a -> AffectationVue.from(a, maintenant)).toList();
    }

    public AffectationVue affecter(Long livreurId, AffectationRequest r) {
        if (r == null || r.zoneId() == null || r.type() == null) throw new IllegalArgumentException("Choisissez une zone et un type d'affectation.");
        Livreur livreur = livreur(livreurId);
        Zone zone = zones.findById(r.zoneId()).orElseThrow(MarketplaceException::absent);
        if (affectations.existsByLivreurIdAndZoneId(livreurId, zone.getId()))
            throw MarketplaceException.conflit("Ce livreur est déjà affecté à la zone « " + zone.getNom() + " ».");
        if (r.type() == TypeAffectation.PRINCIPALE && affectations.existsByLivreurIdAndType(livreurId, TypeAffectation.PRINCIPALE))
            throw MarketplaceException.conflit("Ce livreur a déjà une zone principale. Retirez-la avant d'en choisir une autre.");

        AffectationZone a = new AffectationZone();
        a.setLivreur(livreur);
        a.setZone(zone);
        a.setType(r.type());
        if (r.type() == TypeAffectation.TEMPORAIRE) {
            verifierPeriode(r.debut(), r.fin());
            a.setDebut(r.debut());
            a.setFin(r.fin());
        }
        affectations.save(a);
        audit.enregistrer(ActionAudit.ZONE_LIVREUR_AFFECTEE, livreur, zone.getNom() + " (" + r.type() + ")");
        return AffectationVue.from(a, Instant.now());
    }

    public void retirer(Long livreurId, Long affectationId) {
        AffectationZone a = affectations.findById(affectationId)
                .filter(x -> x.getLivreur().getId().equals(livreurId))
                .orElseThrow(MarketplaceException::absent);
        affectations.delete(a);
        audit.enregistrer(ActionAudit.ZONE_LIVREUR_RETIREE, a.getLivreur(), a.getZone().getNom() + " (" + a.getType() + ")");
    }

    private Livreur livreur(Long id) {
        return livreurs.findById(id).orElseThrow(MarketplaceException::absent);
    }

    private static void verifierPeriode(Instant debut, Instant fin) {
        if (debut == null || fin == null) throw new IllegalArgumentException("Une affectation temporaire a une date de début et de fin.");
        if (!fin.isAfter(debut)) throw new IllegalArgumentException("La fin doit être après le début.");
        if (!fin.isAfter(Instant.now())) throw new IllegalArgumentException("La période de renfort est déjà terminée.");
    }
}
