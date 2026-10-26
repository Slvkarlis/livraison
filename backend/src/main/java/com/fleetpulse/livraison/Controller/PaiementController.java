package com.fleetpulse.livraison.Controller;

import com.fleetpulse.livraison.Dto.LivraisonResponse;
import com.fleetpulse.livraison.Dto.PaiementConfigResponse;
import com.fleetpulse.livraison.Dto.PaiementResponse;
import com.fleetpulse.livraison.Service.PaiementService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PaiementController {
    @Autowired
    private PaiementService paiementService;

    // Cle publique Stripe + disponibilite du paiement par carte
    @GetMapping("/api/paiements/config")
    @PreAuthorize("hasRole('CLIENT')")
    public PaiementConfigResponse config() {
        return paiementService.config();
    }

    @PostMapping("/api/livraisons/{id}/paiement")
    @PreAuthorize("hasRole('CLIENT')")
    public PaiementResponse demarrer(@PathVariable Long id, Authentication authentication) {
        return paiementService.demarrer(id, authentication.getName());
    }

    @PostMapping("/api/livraisons/{id}/paiement/verifier")
    @PreAuthorize("hasRole('CLIENT')")
    public LivraisonResponse verifier(@PathVariable Long id, Authentication authentication) {
        return paiementService.verifier(id, authentication.getName());
    }

    // Public : authentifie par la signature Stripe (voir SecurityConfig)
    @PostMapping("/api/stripe/webhook")
    public ResponseEntity<Void> webhook(@RequestBody String corps,
                                        @RequestHeader(value = "Stripe-Signature", required = false) String signature) {
        paiementService.webhook(corps, signature);
        return ResponseEntity.ok().build();
    }
}
