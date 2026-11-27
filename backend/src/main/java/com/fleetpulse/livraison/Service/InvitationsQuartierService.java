package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.StatutGroupeQuartier;
import com.fleetpulse.livraison.Repository.*;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.event.TransactionalEventListener;

/** Invitations dédupliquées par groupe et plafonnées en base sous verrou du destinataire. */
@Service
public class InvitationsQuartierService {
    @Autowired private GroupeQuartierRepository groupes;
    @Autowired private AdresseLivraisonRepository adresses;
    @Autowired private ClientRepository clients;
    @Autowired private InvitationQuartierRepository invitations;
    @Autowired private NotificationService notifications;

    @TransactionalEventListener
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void inviter(QuartierService.GroupeChange e) {
        GroupeQuartier g = groupes.findById(e.groupeId()).orElse(null);
        Instant maintenant = Instant.now();
        if (g == null || g.getStatut() != StatutGroupeQuartier.OUVERT || !maintenant.isBefore(g.getExpiration())) return;
        Set<Long> membres = new HashSet<>(); g.getCommandes().forEach(c -> membres.add(c.getClient().getId()));
        Set<Long> vus = new HashSet<>();
        for (AdresseLivraison a : adresses.findAll()) {
            if (membres.contains(a.getClient().getId()) || vus.contains(a.getClient().getId())
                    || Distances.km(g.getLatitude(), g.getLongitude(), a.getLatitude(), a.getLongitude()) * 1000 > g.getRayonMetres()
                    || !g.getZone().contient(a.getLatitude(), a.getLongitude())) continue;
            vus.add(a.getClient().getId());
            Client client = clients.verrouiller(a.getClient().getEmail()).orElseThrow();
            LocalDate jour = maintenant.atZone(ZoneId.of("Africa/Tunis")).toLocalDate();
            Instant debut = jour.atStartOfDay(ZoneId.of("Africa/Tunis")).toInstant();
            Instant fin = jour.plusDays(1).atStartOfDay(ZoneId.of("Africa/Tunis")).toInstant();
            if (!client.isActif() || !client.invitationsQuartierActives() || invitations.existsByClientIdAndGroupeId(client.getId(), g.getId())
                    || invitations.countByClientIdAndEnvoyeeLeGreaterThanEqualAndEnvoyeeLeLessThan(client.getId(), debut, fin) >= 2) continue;
            InvitationQuartier i = new InvitationQuartier(); i.setClient(client); i.setGroupe(g); i.setEnvoyeeLe(maintenant); invitations.save(i);
            notifications.inviterQuartier(client, g.getId(), texte(g));
        }
    }

    /** Ne reçoit aucune identité ni adresse des membres. */
    public static String texte(GroupeQuartier g) {
        int n = g.getCommandes().size();
        String heure = DateTimeFormatter.ofPattern("HH:mm").withZone(ZoneId.of("Africa/Tunis")).format(g.getExpiration());
        int reduction = (g.getCommandes().size() == 2 ? java.math.BigDecimal.ONE : g.getReductionDeux())
                .multiply(java.math.BigDecimal.valueOf(100)).intValue();
        return n + (n == 1 ? " voisin vient" : " voisins viennent") + " de commander chez " + g.getCommerce().getNomCommerce()
                + ". Commandez avant " + heure + " : livraison " + (reduction == 100 ? "gratuite" : "-" + reduction + " %") + ".";
    }
}
