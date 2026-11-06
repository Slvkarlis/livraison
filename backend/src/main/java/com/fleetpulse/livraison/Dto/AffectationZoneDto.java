package com.fleetpulse.livraison.Dto;

import com.fleetpulse.livraison.Model.AffectationZone;
import com.fleetpulse.livraison.Model.enums.TypeAffectation;
import java.time.Instant;

/** US-2B11 : zones d'un coursier (back-office du Responsable). */
public final class AffectationZoneDto {
    private AffectationZoneDto() { }

    /** debut et fin : obligatoires pour TEMPORAIRE, ignores sinon. */
    public record AffectationRequest(Long zoneId, TypeAffectation type, Instant debut, Instant fin) { }

    public record AffectationVue(Long id, Long zoneId, String zoneNom, TypeAffectation type, Instant debut, Instant fin,
                                 boolean enVigueur) {
        public static AffectationVue from(AffectationZone a, Instant maintenant) {
            return new AffectationVue(a.getId(), a.getZone().getId(), a.getZone().getNom(), a.getType(), a.getDebut(), a.getFin(),
                    a.enVigueur(maintenant));
        }
    }
}
