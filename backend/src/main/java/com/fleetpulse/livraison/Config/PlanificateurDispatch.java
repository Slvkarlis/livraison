package com.fleetpulse.livraison.Config;

import com.fleetpulse.livraison.Service.DispatchService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

/**
 * Sprint 4 : cycle periodique du dispatch (offres expirees, lots en attente de coursier, fenetre de regroupement).
 * Les minuteurs sont en base (OffreLot.expireLe) : un redemarrage ne perd aucune offre (cahier des charges §2.3).
 * Desactivable (app.dispatch.planificateur=false) : les tests HTTP declenchent le cycle eux-memes.
 */
@Configuration(proxyBeanMethods = false)
@EnableScheduling
@ConditionalOnProperty(name = "app.dispatch.planificateur", havingValue = "true", matchIfMissing = true)
public class PlanificateurDispatch {
    private static final Logger log = LoggerFactory.getLogger(PlanificateurDispatch.class);
    private final DispatchService dispatch;

    public PlanificateurDispatch(DispatchService dispatch) { this.dispatch = dispatch; }

    @Scheduled(fixedDelayString = "${app.dispatch.intervalle-ms:15000}", initialDelayString = "${app.dispatch.intervalle-ms:15000}")
    public void executer() {
        try {
            var cycle = dispatch.cycle();
            if (cycle.offresExpirees() + cycle.offresProposees() > 0)
                log.info("Dispatch : {} offre(s) expiree(s), {} offre(s) proposee(s)", cycle.offresExpirees(), cycle.offresProposees());
        } catch (RuntimeException e) {
            // Conflit avec une action simultanee : le cycle suivant reprend
            log.warn("Cycle de dispatch interrompu : {}", e.getMessage());
        }
    }
}
