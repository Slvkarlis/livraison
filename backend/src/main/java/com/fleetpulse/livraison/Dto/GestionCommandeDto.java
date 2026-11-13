package com.fleetpulse.livraison.Dto;

import com.fleetpulse.livraison.Dto.CommandePartenaireDto.HistoriqueVue;
import com.fleetpulse.livraison.Model.enums.ModeRemise;
import com.fleetpulse.livraison.Model.enums.StatutLivraison;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** US-311 : interventions du responsable sur une commande (motif obligatoire, trace dans l'historique et l'audit). */
public final class GestionCommandeDto {
    private GestionCommandeDto() { }

    public enum ActionResponsable { ANNULER, VALIDER_COLLECTE, VALIDER_REMISE }

    public record MotifRequest(String motif) { }

    /** Remise manuelle : montant reellement encaisse par le livreur (motifEcart si different du total). */
    public record RemiseManuelleRequest(String motif, BigDecimal montantEncaisse, String motifEcart) { }

    /** actions : ce que le responsable peut faire au statut actuel (le backend reverifie a chaque appel). */
    public record SuiviResponsable(Long commandeId, String codeSuivi, StatutLivraison statut, String livreurPrenom,
                                   Instant recupereeLe, Instant livreeLe, BigDecimal montantAttendu, BigDecimal montantEncaisse,
                                   BigDecimal ecartEncaissement, String motifEcart, ModeRemise modeRemise,
                                   Instant annuleeLe, String motifAnnulation,
                                   List<ActionResponsable> actions, List<HistoriqueVue> historique) { }
}
