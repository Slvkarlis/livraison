package com.fleetpulse.livraison.Controller;

import com.fleetpulse.livraison.Dto.NotificationDto.*;
import com.fleetpulse.livraison.Service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

// US-304 : boite de reception et telephones de l'utilisateur connecte (tous roles)
@RestController @RequestMapping("/api/notifications") @RequiredArgsConstructor
public class NotificationController {
    private final NotificationService service;

    @GetMapping
    public BoiteNotifications boite(Authentication a) { return service.boite(a.getName()); }

    @PutMapping("/lues")
    public ResponseEntity<Void> marquerLues(Authentication a) {
        service.marquerLues(a.getName());
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/appareil")
    public ResponseEntity<Void> enregistrerAppareil(Authentication a, @RequestBody AppareilRequest r) {
        service.enregistrerAppareil(a.getName(), r);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/appareil")
    public ResponseEntity<Void> retirerAppareil(Authentication a, @RequestBody AppareilRequest r) {
        service.retirerAppareil(a.getName(), r);
        return ResponseEntity.noContent().build();
    }
}
