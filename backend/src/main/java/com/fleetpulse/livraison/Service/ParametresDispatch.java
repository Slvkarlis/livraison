package com.fleetpulse.livraison.Service;

import org.springframework.boot.context.properties.ConfigurationProperties;

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
@lombok.Getter @lombok.Setter @lombok.NoArgsConstructor
public class ParametresDispatch {
    private boolean parLots = true;
    private int delaiOffreSecondes = 60, delaiRechercheMaxMinutes = 10, dureeABordMaxMinutes = 35;
    private double rayonCollecteKm = 1.5;
    private int fenetreRegroupementSecondes = 30;
    private boolean planificateur = true;
    private long intervalleMs = 15000;
    @org.springframework.beans.factory.annotation.Autowired private ParametresQuartier parametresQuartier;

    public ParametresDispatch(boolean parLots, int delaiOffreSecondes, int delaiRechercheMaxMinutes, int dureeABordMaxMinutes,
                             double rayonCollecteKm, int fenetreRegroupementSecondes, boolean planificateur, long intervalleMs) {
        this.parLots = parLots; this.delaiOffreSecondes = delaiOffreSecondes; this.delaiRechercheMaxMinutes = delaiRechercheMaxMinutes;
        this.dureeABordMaxMinutes = dureeABordMaxMinutes; this.rayonCollecteKm = rayonCollecteKm;
        this.fenetreRegroupementSecondes = fenetreRegroupementSecondes; this.planificateur = planificateur; this.intervalleMs = intervalleMs;
    }
    public boolean parLots() { return parLots; }
    public int delaiOffreSecondes() { return delaiOffreSecondes; }
    public int delaiRechercheMaxMinutes() { return delaiRechercheMaxMinutes; }
    public int dureeABordMaxMinutes() { return dureeABordMaxMinutes; }
    public double rayonCollecteKm() { return rayonCollecteKm; }
    public int fenetreRegroupementSecondes() { return fenetreRegroupementSecondes; }
    public boolean planificateur() { return planificateur; }
    public long intervalleMs() { return intervalleMs; }
    public ParametresQuartier.Reglages quartier() { return parametresQuartier.vue(); }
    public ParametresQuartier.Reglages modifierQuartier(ParametresQuartier.Reglages r) { return parametresQuartier.modifier(r); }

    public java.time.Duration aBordMax() { return java.time.Duration.ofMinutes(dureeABordMaxMinutes); }
}
