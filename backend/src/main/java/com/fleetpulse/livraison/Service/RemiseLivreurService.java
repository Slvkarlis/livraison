package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.EspaceLivreurDto.*;
import com.fleetpulse.livraison.Model.Livraison;
import com.fleetpulse.livraison.Model.Livreur;
import com.fleetpulse.livraison.Model.enums.*;
import com.fleetpulse.livraison.Repository.LivraisonRepository;
import com.fleetpulse.livraison.Repository.LivreurRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * US-306 : remise du colis au client.
 * 1. le coursier confirme le montant reellement encaisse (un ecart avec le total exige un motif) ;
 * 2. il scanne le QR du client (US-305) ou saisit le code recu par SMS (US-310) ;
 * 3. la commande passe a LIVREE, paiement ENCAISSE.
 * Le montant est verifie avant la preuve : une erreur de saisie ne consomme pas d'essai de code.
 */
@Service @RequiredArgsConstructor @Transactional
public class RemiseLivreurService {
    static final int MOTIF_MIN = 5;
    private final LivreurRepository livreurs;
    private final LivraisonRepository commandes;
    private final CommandeWorkflow workflow;
    private final CodeRemiseService codesRemise;
    private final SecretRemise secret;

    public MissionVue valider(String email, Long id, RemiseRequest r) {
        Livreur livreur = livreurs.findByEmail(email).orElseThrow(MarketplaceException::absent);
        Livraison c = commandes.verrouiller(id)
                .filter(l -> l.getLivreur() != null && l.getLivreur().getId().equals(livreur.getId()))
                .orElseThrow(MarketplaceException::absent);
        // Rejeu (reseau instable) : la remise est deja enregistree, rien ne change
        if (c.getStatut() == StatutLivraison.LIVREE) return MissionVue.from(c);
        if (!AffectationMissionService.EN_ROUTE_VERS_CLIENT.contains(c.getStatut()))
            throw MarketplaceException.conflit("Récupérez d'abord le colis à la boutique.");
        if (r == null) throw new IllegalArgumentException("Indiquez le montant encaissé et la preuve de remise.");

        BigDecimal attendu = montantAttendu(c);
        BigDecimal encaisse = montant(r.montantEncaisse());
        BigDecimal ecart = encaisse.subtract(attendu);
        String motif = r.motifEcart() == null ? null : r.motifEcart().trim();
        if (ecart.signum() != 0 && (motif == null || motif.length() < MOTIF_MIN))
            throw new IllegalArgumentException("Le montant encaissé (" + encaisse.toPlainString() + " DT) diffère du total ("
                    + attendu.toPlainString() + " DT) : indiquez le motif de l'écart.");

        ModeRemise mode = verifierPreuve(c, r.preuve());

        c.setMontantEncaisse(encaisse);
        c.setEcartEncaissement(ecart);
        c.setMotifEcart(ecart.signum() == 0 ? null : motif);
        c.setModeRemise(mode);
        c.setLivreeLe(Instant.now().truncatedTo(ChronoUnit.MICROS));
        c.setRemiseNonce(null);   // usage unique : plus aucun QR accepte
        if (c.getModePaiement() == ModePaiement.COD) c.setStatutPaiement(StatutPaiement.ENCAISSE);
        workflow.transition(c, StatutLivraison.LIVREE, livreur, ecart.signum() == 0
                ? "Remise validée par " + libelle(mode)
                : "Remise validée par " + libelle(mode) + ", écart de " + ecart.toPlainString() + " DT : " + motif);
        return MissionVue.from(c);
    }

    private ModeRemise verifierPreuve(Livraison c, String preuve) {
        if (preuve == null || preuve.isBlank())
            throw new IllegalArgumentException("Scannez le QR du client ou saisissez son code à 6 chiffres.");
        if (JetonRemise.estUnQrDeRemise(preuve)) {
            JetonRemise.verifier(preuve, c.getCodeSuivi(), c.getRemiseNonce(), Instant.now(), secret.valeur());
            return ModeRemise.QR;
        }
        String code = preuve.replace(" ", "");
        if (!code.matches("[0-9]{6}"))
            throw new IllegalArgumentException("QR non reconnu : demandez au client d'afficher son QR de remise, ou son code à 6 chiffres.");
        return switch (codesRemise.verifier(c.getId(), code)) {
            case VALIDE -> ModeRemise.CODE;
            case INCORRECT -> throw new IllegalArgumentException("Code de remise incorrect.");
            case BLOQUE -> throw MarketplaceException.conflit(
                    "Trop d'essais avec ce code : le client doit en demander un nouveau, ou afficher son QR.");
        };
    }

    /** Total des commandes marketplace ; anciennes livraisons : montant a collecter. */
    static BigDecimal montantAttendu(Livraison c) {
        BigDecimal total = c.getTotal() != null ? c.getTotal() : BigDecimal.valueOf(c.getMontantACollecter());
        return total.setScale(3, RoundingMode.HALF_UP);
    }

    private static BigDecimal montant(BigDecimal saisi) {
        if (saisi == null) throw new IllegalArgumentException("Indiquez le montant encaissé.");
        if (saisi.signum() < 0) throw new IllegalArgumentException("Le montant encaissé ne peut pas être négatif.");
        if (saisi.stripTrailingZeros().scale() > 3) throw new IllegalArgumentException("Montant : 3 décimales au plus (millimes).");
        return saisi.setScale(3, RoundingMode.UNNECESSARY);
    }

    private static String libelle(ModeRemise mode) {
        return switch (mode) { case QR -> "QR du client"; case CODE -> "code SMS"; case MANUELLE -> "le responsable"; };
    }
}
