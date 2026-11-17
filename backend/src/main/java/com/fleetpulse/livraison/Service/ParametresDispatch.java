package com.fleetpulse.livraison.Service;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Sprint 4 : reglages du dispatch par lots (prefixe app.dispatch).
 *
 * @param parLots false : affectation simple du Sprint 2 bis (AffectationMissionService), sans lot ni offre
 * @param delaiOffreSecondes temps laisse au coursier pour accepter une offre (US-405)
 * @param delaiRechercheMaxMinutes au-dela, une commande prete sans coursier est signalee au responsable (US-402, US-407)
 * @param dureeABordMaxMinutes duree maximale d'un colis dans le vehicule (US-404)
 * @param rayonCollecteKm distance maximale entre deux commerces d'un meme lot (US-403)
 * @param fenetreRegroupementSecondes une commande tout juste prete attend ce delai d'eventuelles voisines avant d'etre proposee seule
 * @param planificateur cycle periodique (expiration des offres, repropositions) ; desactive dans les tests HTTP
 * @param intervalleMs periode du cycle
 */
@ConfigurationProperties(prefix = "app.dispatch")
public record ParametresDispatch(
        @DefaultValue("true") boolean parLots,
        @DefaultValue("60") int delaiOffreSecondes,
        @DefaultValue("10") int delaiRechercheMaxMinutes,
        @DefaultValue("35") int dureeABordMaxMinutes,
        @DefaultValue("1.5") double rayonCollecteKm,
        @DefaultValue("30") int fenetreRegroupementSecondes,
        @DefaultValue("true") boolean planificateur,
        @DefaultValue("15000") long intervalleMs) {

    public java.time.Duration aBordMax() { return java.time.Duration.ofMinutes(dureeABordMaxMinutes); }
}
