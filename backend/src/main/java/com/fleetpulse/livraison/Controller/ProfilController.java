package com.fleetpulse.livraison.Controller;

import com.fleetpulse.livraison.Dto.ProfilResponse;
import com.fleetpulse.livraison.Service.ProfilService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/me")
public class ProfilController {
    @Autowired
    private ProfilService profilService;

    // US-01 : les applications recuperent le role et le vehicule du livreur apres connexion
    @GetMapping
    public ResponseEntity<ProfilResponse> me(Authentication authentication) {
        return profilService.findByEmail(authentication.getName()).map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
