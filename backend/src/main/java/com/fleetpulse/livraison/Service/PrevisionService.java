package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Model.AffectationZone;
import com.fleetpulse.livraison.Model.Livraison;
import com.fleetpulse.livraison.Model.Zone;
import com.fleetpulse.livraison.Repository.AffectationZoneRepository;
import com.fleetpulse.livraison.Repository.LivraisonRepository;
import com.fleetpulse.livraison.Repository.ZoneRepository;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Prevision de la demande (Sprint 8).
 * US-804 : commandes attendues par zone et creneau horaire (service d'IA, ou moyenne historique si le service est indisponible).
 * US-805 : comparaison avec les coursiers disponibles et recommandation de renfort.
 * Le jeu exporte pour l'entrainement (CONTRATS.md, section demande) vient du meme calcul de creneaux.
 */
@Service @RequiredArgsConstructor @Transactional
public class PrevisionService {
    /** Creneaux ouvres : de 10 h a 22 h inclus (heure de Tunis). */
    static final int HEURE_DEBUT = 10;
    static final int HEURE_FIN = 22;
    /** Commandes qu'un coursier disponible peut absorber par heure (hypothese de pilotage, a calibrer en US-518). */
    static final double CAPACITE_PAR_COURSIER = 3.0;
    static final int FENETRE_JOURS = 90;
    static final int HISTORIQUE_REPLI_JOURS = 56;

    private final LivraisonRepository commandes;
    private final ZoneRepository zones;
    private final AffectationZoneRepository affectations;
    private final ServiceIa ia;

    /** Ligne du jeu de demande : une zone, une date, une heure. */
    public record LigneDemande(Long zoneId, String date, int heure, int jourSemaine, boolean ferie, int partenairesActifs, int commandes) { }

    /** Prevision pour un creneau, avec la source qui l'a produite (ia ou moyenne). */
    public record Prevision(Long zoneId, String zone, String date, int heure, double commandesPrevues, String source) { }

    /** Alerte de sous-couverture : prevision superieure a la capacite des coursiers disponibles. */
    public record AlerteCouverture(Long zoneId, String zone, String date, int heure, double commandesPrevues,
                                   int coursiersDisponibles, double capaciteCommandes, int renfortRecommande) { }

    @Transactional(readOnly = true)
    public List<LigneDemande> jeuDemande(Instant depuis) {
        Instant debut = depuis == null ? Instant.now().minus(Duration.ofDays(FENETRE_JOURS)) : depuis;
        Map<String, Agregat> agregats = agreger(debut);
        List<LigneDemande> lignes = new ArrayList<>();
        LocalDate premier = ZonedDateTime.ofInstant(debut, MessagesStatut.FUSEAU).toLocalDate();
        LocalDate dernier = LocalDate.now(MessagesStatut.FUSEAU);
        for (Zone zone : zones.findAllByOrderByIdAsc()) {
            for (LocalDate jour = premier; !jour.isAfter(dernier); jour = jour.plusDays(1)) {
                for (int heure = HEURE_DEBUT; heure <= HEURE_FIN; heure++) {
                    Agregat a = agregats.get(cle(zone.getId(), jour, heure));
                    lignes.add(new LigneDemande(zone.getId(), jour.toString(), heure, jour.getDayOfWeek().getValue(), false,
                            a == null ? 0 : a.partenaires().size(), a == null ? 0 : a.commandes()));
                }
            }
        }
        return lignes;
    }

    /** Previsions d'un jour pour toutes les zones et creneaux ouverts. Le service d'IA est interroge en un seul appel. */
    @Transactional(readOnly = true)
    public List<Prevision> prevoir(LocalDate jour) {
        List<Zone> toutes = zones.findAllByOrderByIdAsc();
        List<ServiceIa.DemandeIa> demandes = new ArrayList<>();
        for (Zone z : toutes) {
            for (int heure = HEURE_DEBUT; heure <= HEURE_FIN; heure++) {
                demandes.add(new ServiceIa.DemandeIa(z.getId(), jour.getDayOfWeek().getValue(), heure, false, 0));
            }
        }
        Optional<ServiceIa.ReponsePrevisions> reponse = ia.predireDemande(demandes);
        Map<String, Double> repli = reponse.isPresent() ? Map.of() : moyennesRepli(jour);
        List<Prevision> resultat = new ArrayList<>();
        Map<Long, String> nomsZones = new HashMap<>();
        toutes.forEach(z -> nomsZones.put(z.getId(), z.getNom()));
        for (int i = 0; i < demandes.size(); i++) {
            ServiceIa.DemandeIa d = demandes.get(i);
            double valeur;
            String source;
            if (reponse.isPresent()) {
                ServiceIa.PrevisionIa p = reponse.get().previsions().get(i);
                valeur = p.commandesPrevues();
                source = "ia:" + reponse.get().modele();
            } else {
                valeur = repli.getOrDefault(cle(d.zoneId(), d.heure()), 0.0);
                source = "moyenne-historique";
            }
            resultat.add(new Prevision(d.zoneId(), nomsZones.get(d.zoneId()), jour.toString(), d.heure(), round(valeur), source));
        }
        return resultat;
    }

    /** US-805 : creneaux ou la demande prevue depasse la capacite des coursiers disponibles dans la zone. */
    @Transactional(readOnly = true)
    public List<AlerteCouverture> alertes(LocalDate jour) {
        Instant maintenant = Instant.now();
        Map<Long, Integer> dispo = new HashMap<>();
        for (Zone z : zones.findAllByOrderByIdAsc()) {
            long n = affectations.findAllByZoneId(z.getId()).stream()
                    .filter(a -> a.enVigueur(maintenant))
                    .filter(a -> a.getLivreur().estDisponible())
                    .map(AffectationZone::getLivreur).distinct().count();
            dispo.put(z.getId(), (int) n);
        }
        List<AlerteCouverture> alertes = new ArrayList<>();
        for (Prevision p : prevoir(jour)) {
            int coursiers = dispo.getOrDefault(p.zoneId(), 0);
            double capacite = coursiers * CAPACITE_PAR_COURSIER;
            if (p.commandesPrevues() > capacite) {
                int renfort = (int) Math.ceil((p.commandesPrevues() - capacite) / CAPACITE_PAR_COURSIER);
                alertes.add(new AlerteCouverture(p.zoneId(), p.zone(), p.date(), p.heure(), p.commandesPrevues(),
                        coursiers, round(capacite), renfort));
            }
        }
        return alertes;
    }

    // ---------------------------------------------------------------- calculs

    private record Agregat(int commandes, Set<Long> partenaires) { }

    private static final class Compte {
        int commandes;
        final Set<Long> partenaires = new HashSet<>();
    }

    Map<String, Agregat> agreger(Instant debut) {
        Map<String, Compte> comptes = new HashMap<>();
        for (Livraison c : commandes.findAllByDateCreationGreaterThanEqualOrderByDateCreationAsc(debut)) {
            Long zoneId = EntrepotService.zoneId(c);
            if (zoneId == null || c.getDateCreation() == null) continue;
            ZonedDateTime local = c.getDateCreation().atZone(MessagesStatut.FUSEAU);
            Compte compte = comptes.computeIfAbsent(cle(zoneId, local.toLocalDate(), local.getHour()), k -> new Compte());
            compte.commandes++;
            compte.partenaires.add(c.getPartenaire().getId());
        }
        Map<String, Agregat> resultat = new HashMap<>();
        comptes.forEach((k, v) -> resultat.put(k, new Agregat(v.commandes, Set.copyOf(v.partenaires))));
        return resultat;
    }

    /** Moyenne des commandes par zone, jour de semaine et heure, sur les dernieres semaines. */
    Map<String, Double> moyennesRepli(LocalDate jour) {
        Instant depuis = Instant.now().minus(Duration.ofDays(HISTORIQUE_REPLI_JOURS));
        Map<String, Agregat> agregats = agreger(depuis);
        Map<String, Double> moyennes = new HashMap<>();
        int jours = HISTORIQUE_REPLI_JOURS / 7;
        for (Zone z : zones.findAllByOrderByIdAsc()) {
            for (int heure = HEURE_DEBUT; heure <= HEURE_FIN; heure++) {
                int total = 0;
                for (int s = 1; s <= jours; s++) {
                    Agregat a = agregats.get(cle(z.getId(), jour.minusWeeks(s), heure));
                    if (a != null) total += a.commandes();
                }
                moyennes.put(cle(z.getId(), heure), (double) total / jours);
            }
        }
        return moyennes;
    }

    private static String cle(Long zoneId, LocalDate jour, int heure) { return zoneId + "|" + jour + "|" + heure; }
    private static String cle(Long zoneId, int heure) { return zoneId + "|" + heure; }

    static double round(double v) { return Math.round(v * 100.0) / 100.0; }
}
