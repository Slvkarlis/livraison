package com.fleetpulse.livraison.Config;

import com.fleetpulse.livraison.Service.AlerteService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.*;

@Configuration(proxyBeanMethods = false) @EnableScheduling @RequiredArgsConstructor
@ConditionalOnProperty(name = "app.bi.planificateur", havingValue = "true", matchIfMissing = true)
public class PlanificateurBi {
    private static final Logger log = LoggerFactory.getLogger(PlanificateurBi.class);
    private final AlerteService service;
    @Scheduled(fixedDelayString = "${app.bi.intervalle-ms:30000}", initialDelayString = "${app.bi.intervalle-ms:30000}")
    public void actualiser() {
        try { service.actualiser(true); service.actualiser(false); }
        catch (RuntimeException e) { log.warn("Évaluation des alertes interrompue : {}", e.getMessage()); }
    }
}
