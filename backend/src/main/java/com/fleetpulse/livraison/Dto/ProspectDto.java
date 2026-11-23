package com.fleetpulse.livraison.Dto;

import com.fleetpulse.livraison.Model.Prospect;
import com.fleetpulse.livraison.Model.enums.StatutProspect;
import java.time.Instant;
import java.util.List;

/** Contrats de la prospection (Sprint 8, US-801 a US-806). Aucune donnee personnelle de client n'y figure. */
public final class ProspectDto {
    private ProspectDto() { }

    /** source : REGISTRE_COMMERCE, PARTENAIRE_RECOMMANDE, SAISIE_TERRAIN ou IMPORT_AUTORISE. */
    public record ImportRequest(String source, List<LigneImport> lignes) { }

    public record LigneImport(String nom, String categorie, String adresse, Double latitude, Double longitude) { }

    public record ImportVue(int crees, List<String> erreurs) { }

    public record ChangementStatut(StatutProspect statut, String commentaire) { }

    public record ProspectVue(Long id, String nom, String categorie, String adresse, Double latitude, Double longitude,
                              String zone, String source, StatutProspect statut, Double score, String scoreModele,
                              Instant statutLe, String commentaire) {
        public static ProspectVue from(Prospect p) {
            return new ProspectVue(p.getId(), p.getNom(), p.getCategorie(), p.getAdresse(), p.getLatitude(), p.getLongitude(),
                    p.getZone() == null ? null : p.getZone().getNom(), p.getSource(), p.getStatut(), p.getScore(),
                    p.getScoreModele(), p.getStatutLe(), p.getCommentaire());
        }
    }

    /** Ligne du jeu d'entrainement du score (CONTRATS.md, section prospection). */
    public record LigneProspection(Long id, String categorie, double distanceClientsKm, int clientsZone, double couvertureZonePct,
                                   int concurrentsProches, boolean converti) { }
}
