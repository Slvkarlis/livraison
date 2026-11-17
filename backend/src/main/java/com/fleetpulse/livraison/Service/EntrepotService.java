package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.EntrepotDto.*;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.StatutLivraison;
import com.fleetpulse.livraison.Model.enums.TypeEvenement;
import com.fleetpulse.livraison.Repository.*;
import java.time.Duration;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * US-401 : entrepot de donnees alimentant les modeles d'IA.
 *
 * <p>Historise les changements de statut et la preparation reelle de chaque commande (apres validation de la transaction,
 * dans une transaction a part : l'entrepot ne bloque jamais une commande), ainsi que les offres et affectations du dispatch.
 * Les traces GPS restent dans PositionLivreur (deja immuable) et sont jointes a l'export.
 */
@Service @RequiredArgsConstructor @Transactional
public class EntrepotService {
    private static final Logger log = LoggerFactory.getLogger(EntrepotService.class);
    static final int LIMITE_MAX = 5000;

    private final EvenementEntrepotRepository evenements;
    private final LivraisonRepository commandes;
    private final PositionLivreurRepository positions;
    private final ZoneRepository zones;

    /** Ecrit dans la transaction de l'appelant (offres, affectations) : un dispatch annule ne laisse pas de trace. */
    public void enregistrer(TypeEvenement type, Long commandeId, Long livreurId, Long zoneId, Long lotId, Double valeur,
                            String code, String details) {
        evenements.save(new EvenementEntrepot(type, Instant.now().truncatedTo(ChronoUnit.MICROS), commandeId, livreurId, zoneId, lotId,
                valeur, code, details));
    }

    @TransactionalEventListener(fallbackExecution = true)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void historiser(CommandeStatutChange e) {
        if (e.ancien() == e.nouveau()) return;   // simple note (delai ajuste) : deja dans l'historique de la commande
        try {
            Livraison c = commandes.findById(e.commandeId()).orElse(null);
            if (c == null) return;
            Long livreurId = c.getLivreur() == null ? null : c.getLivreur().getId();
            Long zoneId = zoneId(c);
            Long lotId = c.getLot() == null ? null : c.getLot().getId();
            enregistrer(TypeEvenement.STATUT, c.getId(), livreurId, zoneId, lotId, null, e.nouveau().name(),
                    (e.ancien() == null ? "CREATION" : e.ancien().name()) + " -> " + e.nouveau()
                            + (e.acteurRole() == null ? "" : " par " + e.acteurRole()));
            if (e.nouveau() == StatutLivraison.PRETE && c.getAccepteeLe() != null && c.getPreteLe() != null)
                enregistrer(TypeEvenement.PREPARATION, c.getId(), null, zoneId, null, minutes(c.getAccepteeLe(), c.getPreteLe()),
                        c.getTempsPreparationMinutes() == null ? null : "ANNONCE_" + c.getTempsPreparationMinutes(),
                        "Préparation réelle vs annoncée (" + c.ajustementsPreparation() + " ajustement(s))");
        } catch (RuntimeException ex) {
            log.warn("Entrepot : evenement de la commande {} non historise : {}", e.commandeId(), ex.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public List<EvenementVue> evenements(Instant depuis, TypeEvenement type, Integer limite) {
        Instant debut = depuis == null ? Instant.EPOCH : depuis;
        Limit l = Limit.of(limite == null || limite < 1 ? 200 : Math.min(limite, LIMITE_MAX));
        var liste = type == null ? evenements.findAllByDateGreaterThanEqualOrderByDateAscIdAsc(debut, l)
                : evenements.findAllByTypeAndDateGreaterThanEqualOrderByDateAscIdAsc(type, debut, l);
        return liste.stream().map(EvenementVue::from).toList();
    }

    /** Jeu d'entrainement de l'ETA : commandes livrees depuis la date donnee. */
    @Transactional(readOnly = true)
    public List<EchantillonEta> jeuEta(Instant depuis) {
        return commandes.findAllByStatutAndLivreeLeGreaterThanEqualOrderByLivreeLeAsc(StatutLivraison.LIVREE,
                depuis == null ? Instant.EPOCH : depuis).stream().map(EntrepotService::echantillon).filter(Objects::nonNull).toList();
    }

    /** Export complet pour le service d'IA (ia/entrainer.py). */
    @Transactional(readOnly = true)
    public ExportEntrepot exporter(Instant depuis) {
        Instant debut = depuis == null ? Instant.EPOCH : depuis;
        List<Zone> toutes = zones.findAllByOrderByIdAsc();
        Map<Long, Set<Long>> voisinages = ZoneService.voisinages(toutes);
        return new ExportEntrepot(Instant.now(), debut, evenements(debut, null, LIMITE_MAX), jeuEta(debut),
                positions.findAllByDateGreaterThanEqualOrderByDateAscIdAsc(debut, Limit.of(LIMITE_MAX)).stream()
                        .map(p -> new TraceVue(p.getLivreur().getId(), p.getLatitude(), p.getLongitude(), p.getPrecisionMetres(), p.getDate())).toList(),
                toutes.stream().map(z -> new ZoneExport(z.getId(), z.getNom(), z.vitesseMoyenne(),
                        voisinages.getOrDefault(z.getId(), Set.of()).stream().sorted().toList())).toList());
    }

    static EchantillonEta echantillon(Livraison c) {
        Partenaire p = c.getPartenaire();
        if (p == null || p.getLatitude() == null || p.getLongitude() == null || c.getAccepteeLe() == null) return null;
        Zone zone = p.getZone();
        ZonedDateTime acceptation = c.getAccepteeLe().atZone(MessagesStatut.FUSEAU);
        double km = Distances.km(p.getLatitude(), p.getLongitude(), c.getLatitude(), c.getLongitude());
        int tailleLot = c.getLot() == null ? 1 : Math.max(1, Itineraire.compterCommandes(c.getLot().getItineraire()));
        return new EchantillonEta(c.getId(), p.getId(), zone == null ? null : zone.getId(), acceptation.getHour(),
                acceptation.getDayOfWeek().getValue(), c.getTempsPreparationMinutes(), minutes(c.getAccepteeLe(), c.getPreteLe()),
                Math.round(km * 1000) / 1000.0, zone == null ? Zone.VITESSE_PAR_DEFAUT_KMH : zone.vitesseMoyenne(), tailleLot,
                minutes(c.getPreteLe(), c.getRecupereeLe()), minutes(c.getRecupereeLe(), c.getLivreeLe()));
    }

    static Long zoneId(Livraison c) {
        return c.getPartenaire() == null || c.getPartenaire().getZone() == null ? null : c.getPartenaire().getZone().getId();
    }

    /** Minutes entre deux instants (au centieme), null si l'un manque. */
    static Double minutes(Instant debut, Instant fin) {
        if (debut == null || fin == null) return null;
        return Math.round(Duration.between(debut, fin).toMillis() / 600.0) / 100.0;
    }
}
