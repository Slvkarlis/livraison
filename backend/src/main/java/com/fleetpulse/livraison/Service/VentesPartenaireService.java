package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.BiDto.*;
import com.fleetpulse.livraison.Repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import static com.fleetpulse.livraison.Service.BiFinanceService.argent;
import static com.fleetpulse.livraison.Service.BiOperationsService.nombre;

@Service @RequiredArgsConstructor @Transactional(readOnly = true)
public class VentesPartenaireService {
    private final PartenaireRepository partenaires;
    private final BiRepository agregats;
    public VentesVue dashboard(String email, PeriodeBi periode) {
        var p = partenaires.findByEmail(email).filter(partenaire -> partenaire.isActif())
                .orElseThrow(() -> new AccessDeniedException("Un partenaire actif est requis."));
        Object[] total = agregats.ventesPartenaire(periode, p.getId());
        return new VentesVue(periode, argent(total[0]), nombre(total[1]), agregats.meilleursProduits(periode, p.getId()).stream()
                .map(r -> new ProduitVenduVue(nombre(r[0]), (String) r[1], nombre(r[2]), argent(r[3]))).toList());
    }
}
