package com.fleetpulse.livraison.Controller;

import com.fleetpulse.livraison.Dto.LivraisonResponse;
import com.fleetpulse.livraison.Service.LivraisonService;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// Creation des commandes : POST /api/commandes (MarketplaceController).
@RestController
@RequestMapping("/api/livraisons")
public class LivraisonController {
    @Autowired
    private LivraisonService livraisonService;

    // US-209 : le client suit les commandes qu'il a creees
    @GetMapping("/mes")
    @PreAuthorize("hasRole('CLIENT')")
    public List<LivraisonResponse> mesLivraisons(Authentication authentication) {
        return livraisonService.listForClient(authentication.getName());
    }

    // US-07
    @GetMapping
    @PreAuthorize("hasRole('RESPONSABLE')")
    public List<LivraisonResponse> list() {
        return livraisonService.listAll();
    }
}
