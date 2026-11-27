package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.LivraisonResponse;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.*;
import com.fleetpulse.livraison.Repository.*;
import java.math.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.event.TransactionalEventListener;

@Service @Transactional
public class PaiementQuartierService {
    @Autowired private PasserelleCarteQuartier carte;
    @Autowired private LivraisonRepository commandes;
    public boolean actif() { return carte.active(); }
    public void ouvrir(Livraison c, BigDecimal plafond) {
        c.setMontantAutoriseCarte(plafond);
        var session = carte.ouvrir(c.getId(), plafond); c.setSessionCarte(session.id()); c.setUrlPaiementCarte(session.url());
    }
    public LivraisonResponse confirmer(String email, Long id) {
        Livraison c = commandes.verrouiller(id).filter(x -> x.getClient().getEmail().equals(email)).orElseThrow(MarketplaceException::absent);
        if (c.getModePaiement() != ModePaiement.CARTE) throw MarketplaceException.conflit("Cette commande n'utilise pas la carte.");
        actualiser(c); return LivraisonResponse.from(c);
    }
    public void synchroniser() {
        if (!actif()) return;
        for (Livraison c : commandes.findAllByModePaiement(ModePaiement.CARTE)) {
            if (c.isCarteAnnulee() || c.getStatut() == StatutLivraison.LIVREE || c.getSessionCarte() == null) continue;
            try { actualiser(c); } catch (MarketplaceException e) { /* Réessai au prochain cycle ; aucun COD de secours. */ }
        }
    }
    void actualiser(Livraison c) {
        if (c.isCarteAnnulee() || c.getSessionCarte() == null) return;
        if (c.getStatut() == StatutLivraison.ANNULEE || c.getStatut() == StatutLivraison.REFUSEE) {
            carte.annuler(c.getSessionCarte(), c.getId()); c.setCarteAnnulee(true); return;
        }
        if (c.getStatutPaiement() == StatutPaiement.PAYE) return;
        var a = carte.verifier(c.getSessionCarte());
        if (!"requires_capture".equals(a.statut()) && !"succeeded".equals(a.statut())) return;
        if (!"tnd".equals(a.devise()) || a.montant().compareTo(c.getMontantAutoriseCarte()) != 0)
            throw MarketplaceException.conflit("Le montant autorisé ne correspond pas à la commande.");
        c.setStripePaymentIntentId(a.intentionId());
        if (c.getGroupeQuartier() != null && (c.getGroupeQuartier().getStatut() == StatutGroupeQuartier.OUVERT
                || c.getGroupeQuartier().getStatut() == StatutGroupeQuartier.COMPLET)) return;
        BigDecimal total = c.getTotal().setScale(2, RoundingMode.DOWN).setScale(3);
        if (total.compareTo(c.getTotal()) < 0) {
            BigDecimal ecart = c.getTotal().subtract(total);
            c.setFraisFinauxQuartier(c.getFraisFinauxQuartier().subtract(ecart)); c.setFraisLivraison(c.getFraisFinauxQuartier().doubleValue()); c.setTotal(total);
            if (c.getFraisAnnoncesQuartier() != null) c.setFraisAnnoncesQuartier(c.getFraisAnnoncesQuartier().min(c.getFraisFinauxQuartier()));
        }
        if ("succeeded".equals(a.statut())) {
            if (a.encaisse() == null || a.encaisse().compareTo(total) != 0)
                throw MarketplaceException.conflit("Le débit carte confirmé ne correspond pas au prix final.");
        } else carte.capturer(a.intentionId(), total, c.getId());
        c.setStatutPaiement(StatutPaiement.PAYE); c.setMontantACollecter(0);
    }
    @TransactionalEventListener @org.springframework.core.annotation.Order(0) @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void groupeFerme(QuartierService.GroupeChange e) { synchroniser(); }
    @TransactionalEventListener @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void commandeAnnulee(CommandeStatutChange e) {
        if (e.nouveau() == StatutLivraison.ANNULEE || e.nouveau() == StatutLivraison.REFUSEE) synchroniser();
    }
}
