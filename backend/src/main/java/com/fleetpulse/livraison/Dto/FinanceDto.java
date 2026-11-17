package com.fleetpulse.livraison.Dto;

import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.PorteeCommission;
import com.fleetpulse.livraison.Model.enums.StatutDepot;
import com.fleetpulse.livraison.Model.enums.TypeEcriture;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/** Sprint 5 : chaine financiere (commissions, ledger, cash des coursiers, depots, closings, remunerations). */
public final class FinanceDto {
    private FinanceDto() { }

    // ---------------------------------------------------------------- US-502 : commissions

    /** portee GLOBAL : sans cible ; CATEGORIE : categorie ; PARTENAIRE : partenaireId. taux en %. */
    public record TauxRequest(PorteeCommission portee, String categorie, Long partenaireId, BigDecimal taux) { }

    public record TauxVue(Long id, PorteeCommission portee, String categorie, Long partenaireId, String nomCommerce,
                          BigDecimal taux, Instant modifieLe, String modifiePar) {
        public static TauxVue from(TauxCommission t) {
            Partenaire p = t.getPartenaire();
            return new TauxVue(t.getId(), t.getPortee(), t.getCategorie(), p == null ? null : p.getId(),
                    p == null ? null : p.getNomCommerce(), t.getTaux(), t.getModifieLe(), t.getModifiePar());
        }
    }

    /** tauxGlobal : taux applique faute de taux plus specifique (12 % tant que rien n'est configure). */
    public record CommissionsVue(BigDecimal tauxGlobal, List<TauxVue> taux) { }

    // ---------------------------------------------------------------- US-512 : bareme par zone

    public record BaremeRequest(BigDecimal base, BigDecimal parKm) { }

    public record BaremeVue(Long zoneId, String zoneNom, BigDecimal base, BigDecimal parKm, boolean parDefaut, Instant modifieLe) { }

    // ---------------------------------------------------------------- US-503 : ledger

    public record EcritureVue(Long id, TypeEcriture type, BigDecimal montant, Long commandeId, Long partenaireId, Long livreurId,
                              Long depotId, Long closingId, String libelle, Instant date) {
        public static EcritureVue from(EcritureLedger e) {
            return new EcritureVue(e.getId(), e.getType(), e.getMontant(), e.getCommandeId(), e.getPartenaireId(), e.getLivreurId(),
                    e.getDepotId(), e.getClosingId(), e.getLibelle(), e.getDate());
        }
    }

    /** US-501 / US-503 : montants figes a la livraison, rattachements (depot, closings) et ecritures de la commande. */
    public record FinanceCommandeVue(Long commandeId, String codeSuivi, Long partenaireId, String nomCommerce, Long livreurId, String livreurNom,
                                     BigDecimal montantArticles, BigDecimal tauxCommission, BigDecimal commission, BigDecimal netPartenaire,
                                     BigDecimal fraisLivraison, BigDecimal montantEncaisse, BigDecimal ecartEncaissement,
                                     BigDecimal remunerationCoursier, double distanceKm, Instant livreeLe, String numeroRecu,
                                     Long closingPartenaireId, Long closingCoursierId, List<EcritureVue> ecritures) { }

    // ---------------------------------------------------------------- US-504 / US-505 : cash

    public record CommandeEncaisseeVue(Long commandeId, String codeSuivi, String nomCommerce, Instant livreeLe,
                                       BigDecimal montantEncaisse, BigDecimal ecartEncaissement) {
        public static CommandeEncaisseeVue from(FinanceCommande f) {
            return new CommandeEncaisseeVue(f.getCommande().getId(), f.getCommande().getCodeSuivi(),
                    f.getPartenaire() == null ? f.getCommande().getNomPartenaire() : f.getPartenaire().getNomCommerce(),
                    f.getLivreeLe(), f.getMontantEncaisse(), f.getEcartEncaissement());
        }
    }

    /** Cash detenu par un coursier : commandes livrees dont le cash n'est pas encore depose. */
    public record SoldeCoursierVue(Long livreurId, String prenom, String nom, BigDecimal solde, int nbCommandes, Instant plusAncienne) { }

    /** Cash en circulation (somme des soldes) et detail par coursier, du plus gros solde au plus petit. */
    public record CaissesVue(BigDecimal cashEnCirculation, List<SoldeCoursierVue> coursiers) { }

    /** cleIdempotence : generee par l'interface ; rejouer le meme depot renvoie le meme recu. */
    public record DepotRequest(Long livreurId, BigDecimal montantRecu, String motifEcart, String cleIdempotence) { }

    public record RecuVue(Long id, String numeroRecu, Long livreurId, String livreurNom, BigDecimal montantAttendu, BigDecimal montantRecu,
                          BigDecimal ecart, String motifEcart, StatutDepot statut, int nbCommandes, Instant date, String enregistrePar,
                          List<CommandeEncaisseeVue> commandes) { }

    public record CaisseCoursierVue(Long livreurId, String prenom, String nom, BigDecimal solde, List<CommandeEncaisseeVue> commandes,
                                    List<RecuVue> recus) { }

    // ---------------------------------------------------------------- US-506 / US-512 : closing

    /** semaine : n'importe quel jour de la semaine a clore (ramene au lundi). */
    public record ClosingRequest(LocalDate semaine) { }

    public record ReleveReversementVue(Long partenaireId, String nomCommerce, int nbCommandes, BigDecimal ventes, BigDecimal commission,
                                       BigDecimal net) { }

    public record ReleveCoursierVue(Long livreurId, String prenom, String nom, int nbMissions, double distanceKm, BigDecimal remuneration) { }

    /**
     * id null : apercu (rien n'est enregistre). commandesNonRapprochees / cashNonRapproche : livrees avant la fin de la semaine
     * mais dont le cash n'est pas depose, donc exclues des reversements jusqu'au depot.
     */
    public record ClosingVue(Long id, LocalDate semaine, Instant debut, Instant fin, Instant valideLe, String validePar,
                             BigDecimal totalReversements, BigDecimal totalRemunerations, int nbCommandesPartenaires, int nbMissions,
                             int commandesNonRapprochees, BigDecimal cashNonRapproche,
                             List<ReleveReversementVue> partenaires, List<ReleveCoursierVue> coursiers) { }

    // ---------------------------------------------------------------- application coursier (US-504, US-512)

    public record ReleveLivreurVue(Long closingId, LocalDate semaine, int nbMissions, double distanceKm, BigDecimal remuneration,
                                   Instant valideLe) { }

    /** remunerationEnAttente : missions livrees pas encore comprises dans un closing. */
    public record CaisseLivreurVue(BigDecimal solde, List<CommandeEncaisseeVue> commandes, List<RecuVue> recus,
                                   int missionsEnAttente, BigDecimal remunerationEnAttente, List<ReleveLivreurVue> releves) { }
}
