package com.fleetpulse.livraison.Controller;

import com.fleetpulse.livraison.Dto.CreateLivraisonRequest;
import com.fleetpulse.livraison.Dto.DevisRequest;
import com.fleetpulse.livraison.Dto.DevisResponse;
import com.fleetpulse.livraison.Dto.LivraisonResponse;
import com.fleetpulse.livraison.Service.LivraisonService;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// Les erreurs de validation (IllegalArgumentException) sont traduites en 400 JSON par GestionErreurs.
@RestController
@RequestMapping("/api/livraisons")
public class LivraisonController {
    @Autowired
    private LivraisonService livraisonService;

    // US-06 : frais calcules par le systeme (distance depot -> adresse + marge), affiches avant confirmation
    @PostMapping("/devis")
    @PreAuthorize("hasRole('CLIENT')")
    public DevisResponse devis(@RequestBody DevisRequest request) {
        return livraisonService.devis(request);
    }

    // US-05 / US-06
    @PostMapping
    @PreAuthorize("hasRole('CLIENT')")
    public ResponseEntity<LivraisonResponse> create(@RequestBody CreateLivraisonRequest request,
                                                     Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(livraisonService.createForUser(request, authentication.getName()));
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
