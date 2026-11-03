package com.fleetpulse.livraison.Service;
import com.fleetpulse.livraison.Dto.MarketplaceDto.*;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Repository.*;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @RequiredArgsConstructor @Transactional
public class AdresseService {
    private final ClientRepository clients;
    private final AdresseLivraisonRepository adresses;
    private final CatalogueService catalogue;
    @Transactional(readOnly = true)
    public List<AdresseVue> lister(String email) { return adresses.findAllByClientEmailOrderByIdAsc(email).stream().map(AdresseVue::from).toList(); }
    public AdresseVue enregistrer(String email, Long id, AdresseRequest r) {
        Client c = clients.verrouiller(email).orElseThrow(MarketplaceException::absent);
        if (r == null || r.libelle() == null || r.libelle().isBlank() || r.libelle().trim().length() > 80
                || r.adresse() == null || r.adresse().isBlank() || r.adresse().trim().length() > 250)
            throw new IllegalArgumentException("Libellé (80 caractères) et adresse (250 caractères) obligatoires.");
        ZoneService.position(r.latitude(), r.longitude());
        if (id == null && adresses.countByClientId(c.getId()) >= 20) throw MarketplaceException.conflit("20 adresses maximum par client.");
        AdresseLivraison a = id == null ? new AdresseLivraison() : catalogue.adresse(email, id);
        a.setClient(c); a.setLibelle(r.libelle().trim()); a.setAdresse(r.adresse().trim()); a.setLatitude(r.latitude()); a.setLongitude(r.longitude());
        return AdresseVue.from(adresses.save(a));
    }
    public void supprimer(String email, Long id) { clients.verrouiller(email).orElseThrow(MarketplaceException::absent); adresses.delete(catalogue.adresse(email, id)); }
}
