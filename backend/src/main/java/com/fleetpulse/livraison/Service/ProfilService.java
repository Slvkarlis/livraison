package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.ProfilResponse;
import com.fleetpulse.livraison.Repository.UtilisateurRepository;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProfilService {
    private final UtilisateurRepository utilisateurRepository;

    public ProfilService(UtilisateurRepository utilisateurRepository) {
        this.utilisateurRepository = utilisateurRepository;
    }

    @Transactional(readOnly = true)
    public Optional<ProfilResponse> findByEmail(String email) {
        return utilisateurRepository.findByEmail(email).map(ProfilResponse::from);
    }
}
