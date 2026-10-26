package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.ProfilResponse;
import com.fleetpulse.livraison.Repository.UtilisateurRepository;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProfilService {
    @Autowired
    private UtilisateurRepository utilisateurRepository;

    @Transactional(readOnly = true)
    public Optional<ProfilResponse> findByEmail(String email) {
        return utilisateurRepository.findByEmail(email).map(ProfilResponse::from);
    }
}
