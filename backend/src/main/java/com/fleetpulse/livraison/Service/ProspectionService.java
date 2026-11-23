package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.ProspectDto.*;
import com.fleetpulse.livraison.Model.Prospect;
import com.fleetpulse.livraison.Model.Zone;
import com.fleetpulse.livraison.Model.enums.ActionAudit;
import com.fleetpulse.livraison.Model.enums.StatutProspect;
import com.fleetpulse.livraison.Repository.LivraisonRepository;
import com.fleetpulse.livraison.Repository.ProspectRepository;
import java.time.Instant;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Prospection automatisee (Sprint 8).
 * US-801 : import de commerces depuis une source autorisee citee par le responsable (fichier ou saisie).
 *          Aucune collecte sur des sites tiers : la source doit etre declaree et licite.
 * US-802 : score de potentiel (service d'IA, ou regle lisible si le service est indisponible).
 * US-803 : liste triee par score, et suivi du statut jusqu'a l'inscription ou le refus.
 */
@Service @RequiredArgsConstructor @Transactional
public class ProspectionService {
    static final int LOT_MAX = 200;
    static final List<String> SOURCES_ACCEPTEES = List.of("REGISTRE_COMMERCE", "PARTENAIRE_RECOMMANDE", "SAISIE_TERRAIN", "IMPORT_AUTORISE");

    private final ProspectRepository prospects;
    private final ZoneService zones;
    private final LivraisonRepository commandes;
    private final ServiceIa ia;
    private final AuditService audit;

    /** US-801 : import d'une liste de commerces ; chaque ligne est validee, les erreurs sont renvoyees sans tout bloquer. */
    public ImportVue importer(ImportRequest r) {
        if (r == null || r.source() == null || !SOURCES_ACCEPTEES.contains(r.source().toUpperCase(Locale.ROOT)))
            throw new IllegalArgumentException("Source non autorisée. Sources acceptées : " + String.join(", ", SOURCES_ACCEPTEES) + ".");
        if (r.lignes() == null || r.lignes().isEmpty()) throw new IllegalArgumentException("Aucune ligne à importer.");
        if (r.lignes().size() > LOT_MAX) throw new IllegalArgumentException(LOT_MAX + " lignes au plus par import.");
        int crees = 0;
        List<String> erreurs = new ArrayList<>();
        for (int i = 0; i < r.lignes().size(); i++) {
            LigneImport l = r.lignes().get(i);
            String erreur = verifier(l);
            if (erreur != null) {
                erreurs.add("ligne " + (i + 1) + " : " + erreur);
                continue;
            }
            Zone zone = zones.trouver(l.latitude(), l.longitude()).orElse(null);
            Prospect p = new Prospect(l.nom().strip(), l.categorie().strip().toUpperCase(Locale.ROOT), l.adresse(),
                    l.latitude(), l.longitude(), r.source().toUpperCase(Locale.ROOT), zone);
            contexte(p);
            prospects.save(p);
            crees++;
        }
        audit.enregistrer(ActionAudit.PROSPECT_IMPORTE, "PROSPECT", null, crees + " prospects importés (" + r.source() + ")");
        return new ImportVue(crees, erreurs);
    }

    /** Recalcule le score de tous les prospects non clos, par lots (un appel IA par lot). */
    public int scorer() {
        List<Prospect> aScorer = prospects.findAllByOrderByScoreDescIdAsc().stream()
                .filter(p -> p.getStatut() != StatutProspect.INSCRIT && p.getStatut() != StatutProspect.REFUSE).toList();
        for (int debut = 0; debut < aScorer.size(); debut += LOT_MAX) {
            List<Prospect> lot = aScorer.subList(debut, Math.min(aScorer.size(), debut + LOT_MAX));
            List<ServiceIa.ProspectIa> entrees = lot.stream().map(p -> new ServiceIa.ProspectIa(p.getCategorie(),
                    p.getDistanceClientsKm(), p.getClientsZone(), p.getCouvertureZonePct(), p.getConcurrentsProches())).toList();
            Optional<ServiceIa.ReponseScores> reponse = ia.scorerProspects(entrees);
            for (int i = 0; i < lot.size(); i++) {
                if (reponse.isPresent()) {
                    ServiceIa.ScoreIa s = reponse.get().scores().get(i);
                    lot.get(i).noterScore(s.score(), "ia:" + s.modele());
                } else {
                    lot.get(i).noterScore(score(lot.get(i)), "regle");
                }
            }
        }
        return aScorer.size();
    }

    @Transactional(readOnly = true)
    public List<ProspectVue> liste(StatutProspect statut) {
        List<Prospect> liste = statut == null ? prospects.findAllByOrderByScoreDescIdAsc()
                : prospects.findAllByStatutOrderByScoreDescIdAsc(statut);
        return liste.stream().map(ProspectVue::from).toList();
    }

    /** US-803 : avancement du recrutement. Un refus est possible a tout moment, sauf apres inscription. */
    public ProspectVue changerStatut(Long id, ChangementStatut r) {
        Prospect p = prospects.findById(id).orElseThrow(MarketplaceException::absent);
        if (r == null || r.statut() == null) throw new IllegalArgumentException("Indiquez le nouveau statut.");
        if (!p.getStatut().peutEvoluerVers(r.statut()))
            throw MarketplaceException.conflit("Passage impossible de " + p.getStatut() + " à " + r.statut() + ".");
        if (r.statut() == StatutProspect.REFUSE && (r.commentaire() == null || r.commentaire().isBlank()))
            throw new IllegalArgumentException("Indiquez le motif du refus.");
        String commentaire = r.commentaire() == null || r.commentaire().isBlank() ? null : r.commentaire().strip();
        p.changerStatut(r.statut(), commentaire, Instant.now());
        audit.enregistrer(ActionAudit.PROSPECT_STATUT_CHANGE, "PROSPECT", p.getId(), p.getNom() + " : " + r.statut());
        return ProspectVue.from(p);
    }

    /** US-806 : jeu d'entrainement du score : prospects dont l'issue est connue (inscrit ou refuse). */
    @Transactional(readOnly = true)
    public List<LigneProspection> jeuProspection() {
        return prospects.findAllByStatutInOrderByStatutLeDesc(List.of(StatutProspect.INSCRIT, StatutProspect.REFUSE)).stream()
                .map(p -> new LigneProspection(p.getId(), p.getCategorie(), p.getDistanceClientsKm(), p.getClientsZone(),
                        p.getCouvertureZonePct(), p.getConcurrentsProches(), p.getStatut() == StatutProspect.INSCRIT))
                .toList();
    }

    // ---------------------------------------------------------------- regles

    private String verifier(LigneImport l) {
        if (l.nom() == null || l.nom().isBlank() || l.nom().length() > 120) return "nom requis (120 caractères au plus)";
        if (l.categorie() == null || l.categorie().isBlank()) return "catégorie requise";
        if (l.latitude() == null || l.longitude() == null) return "coordonnées requises";
        if (l.latitude() < -90 || l.latitude() > 90 || l.longitude() < -180 || l.longitude() > 180) return "coordonnées hors limites";
        return null;
    }

    /** Contexte fige a l'import : clients actifs de la zone, couverture, concurrents proches, distance moyenne. */
    private void contexte(Prospect p) {
        if (p.getZone() == null) {
            p.contexte(0, 0, 0, 0);
            return;
        }
        Instant depuis = Instant.now().minus(java.time.Duration.ofDays(60));
        Set<Long> clients = new HashSet<>();
        double sommeKm = 0;
        int n = 0;
        for (var c : commandes.findAllByDateCreationGreaterThanEqualOrderByDateCreationAsc(depuis)) {
            if (c.getPartenaire() == null || c.getPartenaire().getZone() == null
                    || !c.getPartenaire().getZone().getId().equals(p.getZone().getId())) continue;
            if (c.getClient() != null) clients.add(c.getClient().getId());
            sommeKm += Distances.km(p.getLatitude(), p.getLongitude(), c.getLatitude(), c.getLongitude());
            n++;
        }
        int concurrents = (int) prospects.findAll().stream()
                .filter(x -> !x.getId().equals(p.getId()) && x.getZone() != null && x.getZone().getId().equals(p.getZone().getId())
                        && x.getCategorie().equals(p.getCategorie())).count();
        double couverture = Math.min(100, 100.0 * clients.size() / Math.max(1, clients.size() + 20));
        p.contexte(clients.size(), Math.round(couverture * 10) / 10.0, concurrents, n == 0 ? 0 : Math.round(sommeKm / n * 100) / 100.0);
    }

    /** Score de repli, identique a ia/fleetpulse_ia/prospection.py::score_regle. */
    static double score(Prospect p) {
        double s = 50.0;
        s += Math.min(20.0, p.getClientsZone() / 5.0);
        s += Math.max(0.0, 20.0 - p.getCouvertureZonePct() / 5.0);
        s -= Math.min(25.0, 5.0 * p.getConcurrentsProches());
        s -= Math.min(10.0, 2.0 * p.getDistanceClientsKm());
        return Math.round(Math.max(0.0, Math.min(100.0, s)) * 10) / 10.0;
    }
}
