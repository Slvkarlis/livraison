package com.fleetpulse.livraison.Controller;

import com.fleetpulse.livraison.Dto.CompteResponse;
import com.fleetpulse.livraison.Dto.DossierRequest;
import com.fleetpulse.livraison.Service.CompteService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Le partenaire ou le candidat livreur suit son dossier et le corrige si un complement est demande. */
@RestController
@RequestMapping("/api/dossier")
public class DossierController {
    @Autowired
    private CompteService compteService;

    @GetMapping
    public CompteResponse monDossier(Authentication authentication) {
        return compteService.monDossier(authentication.getName());
    }

    @PutMapping
    @PreAuthorize("hasRole('CANDIDAT')")
    public CompteResponse corriger(@RequestBody DossierRequest request, Authentication authentication) {
        return compteService.corrigerDossier(authentication.getName(), request);
    }
}
