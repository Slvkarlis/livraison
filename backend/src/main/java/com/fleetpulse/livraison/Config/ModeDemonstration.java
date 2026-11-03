package com.fleetpulse.livraison.Config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;

@Component
public class ModeDemonstration {
    private final boolean actif;
    public ModeDemonstration(@Value("${app.demo.enabled:false}") boolean active, Environment environment) {
        this.actif = active && environment.acceptsProfiles(Profiles.of("dev", "demo"))
                && !environment.acceptsProfiles(Profiles.of("prod", "production"));
    }
    public boolean estActif() { return actif; }
}
