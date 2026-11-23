package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Model.Livraison;
import com.fleetpulse.livraison.Model.Partenaire;
import com.fleetpulse.livraison.Model.enums.MotifRefus;
import com.fleetpulse.livraison.Model.enums.StatutLivraison;
import com.fleetpulse.livraison.Repository.LivraisonRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * US-2B6 : une commande restee sans reponse du partenaire expire apres le delai (2 min par defaut, critere global 1).
 * Les expirations consecutives d'un commerce declenchent une pause automatique.
 */
@Service @RequiredArgsConstructor
public class ExpirationCommandeService {
    static final int EXPIRATIONS_AVANT_PAUSE = 3;
    static final Duration DUREE_PAUSE_AUTO = Duration.ofMinutes(60);

    private final LivraisonRepository commandes;
    private final CommandeWorkflow workflow;

    @Value("${app.commandes.delai-reponse-secondes:120}") private int delaiSecondes;

    @Scheduled(fixedDelayString = "${app.commandes.verification-expiration-ms:15000}")
    @Transactional
    public void verifier() { expirerAvant(Instant.now()); }

    /** Expire les commandes en attente depuis plus du delai. Retourne le nombre expire. */
    @Transactional
    public int expirerAvant(Instant maintenant) {
        List<Livraison> expirees = commandes.findAllByStatutAndDateCreationBefore(
                StatutLivraison.PENDING_PARTNER, maintenant.minusSeconds(delaiSecondes));
        for (Livraison c : expirees) {
            Partenaire p = c.getPartenaire();
            workflow.transition(c, StatutLivraison.REFUSEE, p, MotifRefus.EXPIREE.libelle());
            c.setMotifRefus(MotifRefus.EXPIREE);
            p.setExpirationsConsecutives(p.getExpirationsConsecutives() + 1);
            if (p.getExpirationsConsecutives() >= EXPIRATIONS_AVANT_PAUSE) {
                p.setPauseJusqua(maintenant.plus(DUREE_PAUSE_AUTO));
                p.setExpirationsConsecutives(0);
            }
        }
        return expirees.size();
    }
}
