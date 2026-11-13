package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.RemiseDto.*;
import com.fleetpulse.livraison.Model.Livraison;
import com.fleetpulse.livraison.Repository.LivraisonRepository;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Cote client de la remise : QR dynamique (US-305) et renvoi du code de secours (US-310), seulement colis en route. */
@Service @RequiredArgsConstructor @Transactional
public class RemiseClientService {
    private final LivraisonRepository commandes;
    private final CodeRemiseService codesRemise;
    private final SecretRemise secret;

    /** Chaque appel remplace le QR precedent (nouveau nonce) : seul le QR affiche en dernier est valable. */
    public QrRemiseVue qr(String email, Long id) {
        Livraison c = enRoute(email, id);
        Instant expireLe = Instant.now().plusSeconds(JetonRemise.DUREE_SECONDES).truncatedTo(java.time.temporal.ChronoUnit.SECONDS);
        c.setRemiseNonce(JetonRemise.nouveauNonce());
        c.setRemiseQrExpireLe(expireLe);
        return new QrRemiseVue(JetonRemise.contenu(c.getCodeSuivi(), c.getRemiseNonce(), expireLe, secret.valeur()), expireLe);
    }

    public CodeRemiseEnvoye renvoyerCode(String email, Long id) {
        Livraison c = enRoute(email, id);
        Instant prochain = codesRemise.renvoyer(c);
        return new CodeRemiseEnvoye(CodeRemiseService.destinationMasquee(c.getClient()), prochain);
    }

    /** Commande du client, verrouillee, colis a bord ; sinon 404 (autre client) ou 409. */
    private Livraison enRoute(String email, Long id) {
        Livraison c = commandes.verrouiller(id).filter(l -> l.getClient().getEmail().equals(email)).orElseThrow(MarketplaceException::absent);
        if (!AffectationMissionService.EN_ROUTE_VERS_CLIENT.contains(c.getStatut()))
            throw MarketplaceException.conflit("La remise est possible quand le livreur a récupéré votre commande.");
        return c;
    }
}
