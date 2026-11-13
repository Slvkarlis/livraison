package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.CommandePartenaireDto.HistoriqueVue;
import com.fleetpulse.livraison.Dto.GestionCommandeDto.*;
import com.fleetpulse.livraison.Model.Livraison;
import com.fleetpulse.livraison.Model.Utilisateur;
import com.fleetpulse.livraison.Model.enums.ActionAudit;
import com.fleetpulse.livraison.Model.enums.StatutLivraison;
import com.fleetpulse.livraison.Repository.HistoriqueStatutRepository;
import com.fleetpulse.livraison.Repository.LivraisonRepository;
import com.fleetpulse.livraison.Repository.UtilisateurRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * US-311 : le responsable intervient sur une commande bloquee :
 * annulation, collecte validee sans scan (etiquette illisible), remise validee sans preuve du client.
 * Chaque intervention exige un motif, passe par CommandeWorkflow (historique + notifications) et est auditee.
 */
@Service @RequiredArgsConstructor @Transactional
public class GestionCommandeService {
    static final int MOTIF_MIN = 5, MOTIF_MAX = 300;
    /** Toute commande non terminee ; le client, lui, n'annule qu'avant la preparation (CommandeService.ANNULABLES). */
    static final Set<StatutLivraison> ANNULABLES = EnumSet.of(StatutLivraison.PENDING_PARTNER, StatutLivraison.ACCEPTEE,
            StatutLivraison.EN_PREPARATION, StatutLivraison.PRETE, StatutLivraison.AFFECTEE, StatutLivraison.RECUPEREE,
            StatutLivraison.A_PROXIMITE);

    private final LivraisonRepository commandes;
    private final HistoriqueStatutRepository historique;
    private final UtilisateurRepository utilisateurs;
    private final CommandeWorkflow workflow;
    private final CodeRemiseService codesRemise;
    private final RemiseLivreurService remise;
    private final AuditService audit;

    @Transactional(readOnly = true)
    public SuiviResponsable suivi(Long id) {
        return vue(commandes.findById(id).orElseThrow(MarketplaceException::absent));
    }

    public SuiviResponsable annuler(String email, Long id, MotifRequest r) {
        String motif = motif(r == null ? null : r.motif());
        Livraison c = verrouiller(id);
        if (!ANNULABLES.contains(c.getStatut())) throw MarketplaceException.conflit("Cette commande est déjà terminée.");
        StatutLivraison avant = c.getStatut();
        c.setAnnuleeLe(Instant.now().truncatedTo(ChronoUnit.MICROS));
        c.setMotifAnnulation(motif);
        c.setAnnuleeParService(true);
        c.setRemiseNonce(null);   // plus aucun QR de remise accepte
        workflow.transition(c, StatutLivraison.ANNULEE, responsable(email), "Annulée par le responsable : " + motif);
        audit.enregistrer(ActionAudit.COMMANDE_ANNULEE, "COMMANDE", c.getId(), c.getCodeSuivi() + " (" + avant + ") : " + motif);
        return vue(c);
    }

    /** Etiquette abimee, scanner en panne : le responsable confirme que le livreur a bien le colis. */
    public SuiviResponsable validerCollecte(String email, Long id, MotifRequest r) {
        String motif = motif(r == null ? null : r.motif());
        Livraison c = verrouiller(id);
        if (c.getStatut() != StatutLivraison.AFFECTEE)
            throw MarketplaceException.conflit("La collecte se valide quand un livreur est affecté et n'a pas encore le colis.");
        c.setRecupereeLe(Instant.now().truncatedTo(ChronoUnit.MICROS));
        workflow.transition(c, StatutLivraison.RECUPEREE, responsable(email), "Collecte validée par le responsable : " + motif);
        codesRemise.creerEtEnvoyer(c);   // comme une collecte scannee : le client recoit son code de remise
        audit.enregistrer(ActionAudit.COLLECTE_VALIDEE_MANUELLEMENT, "COMMANDE", c.getId(), c.getCodeSuivi() + " : " + motif);
        return vue(c);
    }

    /** Telephone du client hors service, QR et SMS impossibles : le responsable confirme la remise et le montant encaisse. */
    public SuiviResponsable validerRemise(String email, Long id, RemiseManuelleRequest r) {
        if (r == null) throw new IllegalArgumentException("Indiquez le motif et le montant encaissé.");
        String motif = motif(r.motif());
        Livraison c = verrouiller(id);
        remise.validerManuellement(c, responsable(email), r.montantEncaisse(), r.motifEcart(), motif);
        audit.enregistrer(ActionAudit.REMISE_VALIDEE_MANUELLEMENT, "COMMANDE", c.getId(),
                c.getCodeSuivi() + " : " + motif + " ; encaissé " + c.getMontantEncaisse().toPlainString() + " DT"
                        + (c.getEcartEncaissement().signum() == 0 ? "" : " (écart " + c.getEcartEncaissement().toPlainString() + " DT : " + c.getMotifEcart() + ")"));
        return vue(c);
    }

    static List<ActionResponsable> actions(StatutLivraison statut) {
        List<ActionResponsable> actions = new ArrayList<>();
        if (statut == StatutLivraison.AFFECTEE) actions.add(ActionResponsable.VALIDER_COLLECTE);
        if (AffectationMissionService.EN_ROUTE_VERS_CLIENT.contains(statut)) actions.add(ActionResponsable.VALIDER_REMISE);
        if (ANNULABLES.contains(statut)) actions.add(ActionResponsable.ANNULER);
        return actions;
    }

    private SuiviResponsable vue(Livraison c) {
        return new SuiviResponsable(c.getId(), c.getCodeSuivi(), c.getStatut(), c.getLivreur() == null ? null : c.getLivreur().getPrenom(),
                c.getRecupereeLe(), c.getLivreeLe(), RemiseLivreurService.montantAttendu(c), c.getMontantEncaisse(),
                c.getEcartEncaissement(), c.getMotifEcart(), c.getModeRemise(), c.getAnnuleeLe(), c.getMotifAnnulation(),
                actions(c.getStatut()),
                historique.findAllByCommandeIdOrderByDateAscIdAsc(c.getId()).stream().map(HistoriqueVue::from).toList());
    }

    private static String motif(String saisi) {
        String motif = saisi == null ? "" : saisi.trim();
        if (motif.length() < MOTIF_MIN) throw new IllegalArgumentException("Indiquez le motif de l'intervention (" + MOTIF_MIN + " caractères minimum).");
        if (motif.length() > MOTIF_MAX) throw new IllegalArgumentException("Motif trop long (" + MOTIF_MAX + " caractères maximum).");
        return motif;
    }

    private Livraison verrouiller(Long id) {
        return commandes.verrouiller(id).orElseThrow(MarketplaceException::absent);
    }

    private Utilisateur responsable(String email) {
        return utilisateurs.findByEmail(email).orElseThrow(MarketplaceException::absent);
    }
}
