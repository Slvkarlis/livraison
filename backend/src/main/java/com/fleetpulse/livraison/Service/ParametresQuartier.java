package com.fleetpulse.livraison.Service;

import java.math.BigDecimal;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Configuration au démarrage ; modifications admin atomiques pour les prochains groupes. */
@Getter @Setter @ConfigurationProperties(prefix = "app.quartier")
public class ParametresQuartier {
    @org.springframework.beans.factory.annotation.Autowired private com.fleetpulse.livraison.Repository.ConfigurationQuartierRepository configurations;
    private static final tools.jackson.databind.json.JsonMapper JSON = tools.jackson.databind.json.JsonMapper.builder().build();
    @jakarta.annotation.PostConstruct
    void charger() { configurations.findById(1L).ifPresent(c -> appliquer(JSON.readValue(c.getValeur(), Reglages.class))); }
    private double rayonMetres = 400;
    private int fenetreSecondes = 480;
    private int preparationMinutes = 15;
    private int promesseMinutes = 60;
    private BigDecimal reductionDeux = new BigDecimal("0.40");
    private BigDecimal reductionTrois = new BigDecimal("0.50");
    private BigDecimal coutKm = new BigDecimal("0.500");
    public record Reglages(double rayonMetres, int fenetreSecondes, int preparationMinutes, int promesseMinutes,
                           BigDecimal reductionDeux, BigDecimal reductionTrois, BigDecimal coutKm) { }
    public synchronized Reglages vue() {
        return new Reglages(rayonMetres, fenetreSecondes, preparationMinutes, promesseMinutes, reductionDeux, reductionTrois, coutKm);
    }
    public synchronized Reglages modifier(Reglages r) {
        verifier(r);
        if (configurations != null) {
            var c = new com.fleetpulse.livraison.Model.ConfigurationQuartier(); c.setValeur(JSON.writeValueAsString(r)); configurations.saveAndFlush(c);
        }
        appliquer(r); return vue();
    }
    private static void verifier(Reglages r) {
        if (r == null || !Double.isFinite(r.rayonMetres()) || r.rayonMetres() < 10 || r.rayonMetres() > 2000
                || r.fenetreSecondes() < 1 || r.fenetreSecondes() > 900 || r.preparationMinutes() < 0 || r.preparationMinutes() > 120
                || r.promesseMinutes() < 1 || r.promesseMinutes() > 240 || !taux(r.reductionDeux()) || !taux(r.reductionTrois())
                || r.coutKm() == null || r.coutKm().signum() < 0 || r.coutKm().compareTo(new BigDecimal("100")) > 0)
            throw new MarketplaceException(400, "PARAMETRES_QUARTIER", "Rayon 10–2000 m, fenêtre 1–900 s, taux entre 0 et 1 et coût/km positif.");
    }
    private synchronized void appliquer(Reglages r) {
        verifier(r);
        rayonMetres = r.rayonMetres(); fenetreSecondes = r.fenetreSecondes(); preparationMinutes = r.preparationMinutes();
        promesseMinutes = r.promesseMinutes(); reductionDeux = r.reductionDeux(); reductionTrois = r.reductionTrois(); coutKm = r.coutKm();
    }
    private static boolean taux(BigDecimal t) { return t != null && t.signum() >= 0 && t.compareTo(BigDecimal.ONE) <= 0; }
}
