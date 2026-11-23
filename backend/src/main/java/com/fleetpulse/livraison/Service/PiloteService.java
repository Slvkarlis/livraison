package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Model.Livraison;
import com.fleetpulse.livraison.Model.Zone;
import com.fleetpulse.livraison.Model.enums.ActionAudit;
import com.fleetpulse.livraison.Model.enums.MotifRefus;
import com.fleetpulse.livraison.Model.enums.StatutLivraison;
import com.fleetpulse.livraison.Repository.LivraisonRepository;
import com.fleetpulse.livraison.Repository.ZoneRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * US-519 : pilote sur 1 a 3 zones. Le responsable choisit les zones ; le tableau de suivi ne porte que sur elles.
 * Les indicateurs sont calcules sur les commandes creees depuis la date donnee, sans donnee personnelle.
 */
@Service @RequiredArgsConstructor @Transactional
public class PiloteService {
    static final int ZONES_MAX = 3;

    private final ZoneRepository zones;
    private final LivraisonRepository commandes;
    private final AuditService audit;

    public record ZonePilote(Long id, String nom, boolean pilote) { }

    public record KpiPilote(String zone, int commandes, int livrees, int echecs, int expirees,
                            Double delaiMoyenMinutes, Double respectEtaPct) { }

    public List<ZonePilote> zones() {
        return zones.findAllByOrderByIdAsc().stream().map(z -> new ZonePilote(z.getId(), z.getNom(), z.isPilote())).toList();
    }

    public ZonePilote definir(Long zoneId, boolean pilote) {
        Zone z = zones.findById(zoneId).orElseThrow(MarketplaceException::absent);
        if (pilote && !z.isPilote()) {
            long actives = zones.findAll().stream().filter(Zone::isPilote).count();
            if (actives >= ZONES_MAX)
                throw MarketplaceException.conflit("Le pilote compte " + ZONES_MAX + " zones au plus. Retirez-en une avant d'en ajouter.");
        }
        z.setPilote(pilote);
        audit.enregistrer(ActionAudit.ZONE_MODIFIEE, "ZONE", z.getId(), z.getNom() + " : pilote=" + pilote);
        return new ZonePilote(z.getId(), z.getNom(), z.isPilote());
    }

    @Transactional(readOnly = true)
    public List<KpiPilote> kpi(Instant depuis) {
        Instant debut = depuis == null ? Instant.now().minus(Duration.ofDays(30)) : depuis;
        List<KpiPilote> resultat = new java.util.ArrayList<>();
        for (Zone z : zones.findAllByOrderByIdAsc()) {
            if (!z.isPilote()) continue;
            List<Livraison> cohorte = commandes.findAllByDateCreationGreaterThanEqualOrderByDateCreationAsc(debut).stream()
                    .filter(c -> c.getPartenaire() != null && c.getPartenaire().getZone() != null
                            && c.getPartenaire().getZone().getId().equals(z.getId())).toList();
            int livrees = (int) cohorte.stream().filter(c -> c.getStatut() == StatutLivraison.LIVREE).count();
            int echecs = (int) cohorte.stream().filter(c -> c.getStatut() == StatutLivraison.ECHEC).count();
            int expirees = (int) cohorte.stream().filter(c -> c.getMotifRefus() == MotifRefus.EXPIREE).count();
            List<Livraison> livreesAvecDelai = cohorte.stream()
                    .filter(c -> c.getStatut() == StatutLivraison.LIVREE && c.getLivreeLe() != null && c.getDateCreation() != null).toList();
            Double delai = livreesAvecDelai.isEmpty() ? null : arrondi(livreesAvecDelai.stream()
                    .mapToDouble(c -> Duration.between(c.getDateCreation(), c.getLivreeLe()).toSeconds() / 60.0).average().orElse(0));
            List<Livraison> avecPromesse = cohorte.stream()
                    .filter(c -> c.getStatut() == StatutLivraison.LIVREE && c.getPromesseLivraison() != null && c.getLivreeLe() != null).toList();
            Double respect = avecPromesse.isEmpty() ? null : arrondi(100.0 * avecPromesse.stream()
                    .filter(c -> !c.getLivreeLe().isAfter(c.getPromesseLivraison())).count() / avecPromesse.size());
            resultat.add(new KpiPilote(z.getNom(), cohorte.size(), livrees, echecs, expirees, delai, respect));
        }
        return resultat;
    }

    static double arrondi(double v) { return Math.round(v * 100.0) / 100.0; }
}
