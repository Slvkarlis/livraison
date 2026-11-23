package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Model.Partenaire;
import com.fleetpulse.livraison.Repository.UtilisateurRepository;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalTime;
import java.util.List;
import java.util.stream.IntStream;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** US-2B6 : horaires d'ouverture, pause manuelle et reprise du commerce connecte. */
@Service @RequiredArgsConstructor @Transactional
public class BoutiqueService {
    static final int PAUSE_MIN_MINUTES = 15;
    static final int PAUSE_MAX_MINUTES = 1440;

    private final UtilisateurRepository utilisateurs;

    public record Horaires(String ouverture, String fermeture, List<Integer> jours) { }

    public record Etat(boolean ouvert, Horaires horaires, Instant pauseJusqua, boolean acceptePourCommandes,
                       int expirationsConsecutives) { }

    @Transactional(readOnly = true)
    public Etat etat(String email) {
        return vue(partenaire(email), Instant.now());
    }

    public Etat modifierHoraires(String email, Horaires h) {
        Partenaire p = partenaire(email);
        if (h == null) throw new IllegalArgumentException("Indiquez les horaires.");
        if (h.ouverture() == null && h.fermeture() == null) {
            p.setHeureOuverture(null);
            p.setHeureFermeture(null);
        } else {
            int ouverture = minutes(h.ouverture(), "ouverture");
            int fermeture = minutes(h.fermeture(), "fermeture");
            if (ouverture == fermeture) throw new IllegalArgumentException("L'ouverture et la fermeture doivent être différentes.");
            p.setHeureOuverture(ouverture);
            p.setHeureFermeture(fermeture);
        }
        p.setJoursOuverts(masque(h.jours()));
        return vue(p, Instant.now());
    }

    /** Pause de 15 minutes a 24 heures. Une nouvelle pause remplace la precedente. */
    public Etat pause(String email, Integer minutes) {
        Partenaire p = partenaire(email);
        if (minutes == null || minutes < PAUSE_MIN_MINUTES || minutes > PAUSE_MAX_MINUTES)
            throw new IllegalArgumentException("Durée de pause : de " + PAUSE_MIN_MINUTES + " minutes à 24 heures.");
        Instant maintenant = Instant.now();
        p.setPauseJusqua(maintenant.plus(Duration.ofMinutes(minutes)));
        return vue(p, maintenant);
    }

    public Etat reprendre(String email) {
        Partenaire p = partenaire(email);
        p.setPauseJusqua(null);
        return vue(p, Instant.now());
    }

    private Etat vue(Partenaire p, Instant maintenant) {
        Horaires h = p.getHeureOuverture() == null || p.getHeureFermeture() == null ? null
                : new Horaires(heure(p.getHeureOuverture()), heure(p.getHeureFermeture()), jours(p.getJoursOuverts()));
        boolean enPause = p.getPauseJusqua() != null && maintenant.isBefore(p.getPauseJusqua());
        return new Etat(Boolean.TRUE.equals(p.getOuvert()), h, enPause ? p.getPauseJusqua() : null,
                p.accepteCommandes(maintenant), p.getExpirationsConsecutives());
    }

    private Partenaire partenaire(String email) {
        return utilisateurs.findByEmail(email).filter(Partenaire.class::isInstance).map(Partenaire.class::cast)
                .orElseThrow(MarketplaceException::absent);
    }

    static int minutes(String heure, String nom) {
        try {
            LocalTime t = LocalTime.parse(heure);
            return t.getHour() * 60 + t.getMinute();
        } catch (RuntimeException e) {
            throw new IllegalArgumentException("Heure de " + nom + " invalide (format HH:mm).");
        }
    }

    static String heure(int minutes) { return String.format("%02d:%02d", minutes / 60, minutes % 60); }

    static int masque(List<Integer> jours) {
        if (jours == null || jours.isEmpty()) throw new IllegalArgumentException("Indiquez au moins un jour d'ouverture.");
        int masque = 0;
        for (int j : jours) {
            if (j < 1 || j > 7) throw new IllegalArgumentException("Jour invalide : 1 (lundi) à 7 (dimanche).");
            masque |= 1 << (j - 1);
        }
        return masque;
    }

    static List<Integer> jours(int masque) {
        return IntStream.rangeClosed(1, 7).filter(j -> ((masque >> (j - 1)) & 1) == 1).boxed().toList();
    }
}
