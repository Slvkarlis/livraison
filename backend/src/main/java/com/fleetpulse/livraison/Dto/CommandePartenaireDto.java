package com.fleetpulse.livraison.Dto;

import com.fleetpulse.livraison.Dto.MarketplaceDto.LigneVue;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.MotifRefus;
import com.fleetpulse.livraison.Model.enums.Role;
import com.fleetpulse.livraison.Model.enums.StatutLivraison;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** Commandes vues par le partenaire : prenom du client uniquement, ni email, ni telephone, ni adresse exacte. */
public final class CommandePartenaireDto {
    private CommandePartenaireDto() { }

    /** Acceptation (temps annonce) et ajustement (delai restant). */
    public record TempsPreparationRequest(Integer tempsPreparationMinutes) { }
    public record RefusRequest(MotifRefus motif, String commentaire) { }

    public record CommandeResume(Long id, String codeSuivi, StatutLivraison statut, Instant dateCreation, String clientPrenom,
                                 int nbArticles, BigDecimal total) {
        public static CommandeResume from(Livraison c) {
            return new CommandeResume(c.getId(), c.getCodeSuivi(), c.getStatut(), c.getDateCreation(), c.getClient().getPrenom(),
                    compterArticles(c), c.getTotal());
        }
    }

    public record HistoriqueVue(StatutLivraison ancien, StatutLivraison nouveau, Role acteurRole, String motif, Instant date) {
        public static HistoriqueVue from(HistoriqueStatut h) {
            return new HistoriqueVue(h.getAncien(), h.getNouveau(), h.getActeurRole(), h.getMotif(), h.getDate());
        }
    }

    public record CommandeDetail(Long id, String codeSuivi, StatutLivraison statut, Instant dateCreation, String clientPrenom,
                                 String zoneNom, List<LigneVue> lignes, int nbArticles, String notes, BigDecimal montantArticles,
                                 BigDecimal fraisLivraison, BigDecimal total, Integer tempsPreparationMinutes, Instant accepteeLe,
                                 MotifRefus motifRefus, String commentaireRefus, Instant pretePrevueLe, int nbAjustementsPreparation,
                                 Instant preparationDebutLe, Instant preteLe, List<HistoriqueVue> historique) {
        public static CommandeDetail from(Livraison c, List<HistoriqueStatut> historique) {
            return new CommandeDetail(c.getId(), c.getCodeSuivi(), c.getStatut(), c.getDateCreation(), c.getClient().getPrenom(),
                    c.getNomZone(), c.getLignes().stream().map(LigneVue::from).toList(), compterArticles(c), c.getNotes(), c.getMontantArticles(),
                    BigDecimal.valueOf(c.getFraisLivraison()).setScale(3), c.getTotal(), c.getTempsPreparationMinutes(), c.getAccepteeLe(),
                    c.getMotifRefus(), c.getCommentaireRefus(), c.heurePretePrevue(), c.ajustementsPreparation(),
                    c.getPreparationDebutLe(), c.getPreteLe(), historique.stream().map(HistoriqueVue::from).toList());
        }
    }

    private static int compterArticles(Livraison c) {
        return c.getLignes().stream().mapToInt(LigneCommande::getQuantite).sum();
    }
}
