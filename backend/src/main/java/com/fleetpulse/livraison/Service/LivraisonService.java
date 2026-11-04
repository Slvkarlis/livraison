package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.LivraisonResponse;
import com.fleetpulse.livraison.Repository.LivraisonRepository;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// Les commandes sont creees par CommandeService (catalogue, paiement a la livraison uniquement).
@Service
public class LivraisonService {
    @Autowired
    private LivraisonRepository livraisonRepository;

    @Transactional(readOnly = true)
    public List<LivraisonResponse> listAll() {
        return livraisonRepository.findAllByOrderByDateCreationDesc().stream()
                .map(LivraisonResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<LivraisonResponse> listForClient(String clientEmail) {
        return livraisonRepository.findAllByClientEmailOrderByDateCreationDesc(clientEmail).stream()
                .map(LivraisonResponse::from).toList();
    }
}
