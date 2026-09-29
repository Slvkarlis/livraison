package com.fleetpulse.livraison.Controller;

import com.fleetpulse.livraison.Dto.CreateLivraisonRequest;
import com.fleetpulse.livraison.Dto.LivraisonResponse;
import com.fleetpulse.livraison.Service.LivraisonService;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/livraisons")
public class LivraisonController {
    private final LivraisonService livraisonService;

    public LivraisonController(LivraisonService livraisonService) {
        this.livraisonService = livraisonService;
    }

    // US-05 / US-06
    @PostMapping
    @PreAuthorize("hasRole('CLIENT')")
    public ResponseEntity<LivraisonResponse> create(@RequestBody CreateLivraisonRequest request,
                                                     Authentication authentication) {
        try {
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(livraisonService.createForUser(request, authentication.getName()));
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.badRequest().build();
        }
    }

    // US-06 : le client suit les commandes qu'il a creees
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
