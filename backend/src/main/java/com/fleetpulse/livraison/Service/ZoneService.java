package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.MarketplaceDto.*;
import com.fleetpulse.livraison.Dto.MarketplaceDto.Position;
import com.fleetpulse.livraison.Model.*;
import com.fleetpulse.livraison.Model.enums.ActionAudit;
import com.fleetpulse.livraison.Repository.*;
import java.math.*;
import java.util.*;
import org.locationtech.jts.geom.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import lombok.RequiredArgsConstructor;

@Service @RequiredArgsConstructor
public class ZoneService {
    private final ZoneRepository zones;
    private final PartenaireRepository partenaires;
    private final AffectationZoneRepository affectations;
    private final AuditService audit;
    private final jakarta.persistence.EntityManager entityManager;
    private static final GeometryFactory GEOMETRY = new GeometryFactory(new PrecisionModel(), 4326);

    static final double VITESSE_MIN_KMH = 5, VITESSE_MAX_KMH = 80;
    public static void position(Double latitude, Double longitude) {
        if (latitude == null || longitude == null || !Double.isFinite(latitude) || !Double.isFinite(longitude)
                || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180)
            throw new IllegalArgumentException("Position géographique invalide.");
    }
    public static Polygon polygone(List<Position> points) {
        if (points == null || points.size() < 3 || points.size() > 200)
            throw new IllegalArgumentException("Tracez un polygone de 3 à 200 sommets.");
        List<Coordinate> coords = new ArrayList<>();
        for (Position p : points) {
            if (p == null) throw new IllegalArgumentException("Sommet invalide.");
            position(p.latitude(), p.longitude());
            coords.add(new Coordinate(p.longitude(), p.latitude()));
        }
        if (!coords.getFirst().equals2D(coords.getLast())) coords.add(coords.getFirst().copy());
        Polygon polygon = GEOMETRY.createPolygon(coords.toArray(Coordinate[]::new));
        if (!polygon.isValid() || polygon.isEmpty() || polygon.getArea() < 1e-10)
            throw new IllegalArgumentException("Polygone invalide : évitez les croisements et les points alignés.");
        return polygon;
    }
    @Transactional(readOnly = true)
    public Optional<Zone> trouver(double lat, double lng) {
        position(lat, lng);
        return zones.candidates(lat, lng).stream().filter(z -> z.contient(lat, lng)).findFirst();
    }
    public Zone desservie(double lat, double lng) {
        return trouver(lat, lng).orElseThrow(() -> new IllegalArgumentException("Adresse non desservie : aucune zone ne couvre cette position."));
    }
    @Transactional(readOnly = true)
    public List<ZoneVue> lister() {
        var commerces = partenaires.findAll();
        var toutes = zones.findAllByOrderByIdAsc();
        return toutes.stream().map(z -> ZoneVue.from(z, commerces.stream()
                .filter(p -> p.getZone() != null && p.getZone().getId().equals(z.getId())).count(), voisines(z, toutes))).toList();
    }

    /** Voisinage dérivé des contours : toujours cohérent après modification ou suppression, sans table dupliquée. */
    private static List<ZoneVoisine> voisines(Zone zone, List<Zone> toutes) {
        return toutes.stream().filter(autre -> !Objects.equals(zone.getId(), autre.getId()))
                .filter(autre -> zone.getPolygone().touches(autre.getPolygone())
                        && zone.getPolygone().intersection(autre.getPolygone()).getLength() > 1e-12)
                .map(autre -> new ZoneVoisine(autre.getId(), autre.getNom())).toList();
    }
    /** SERIALIZABLE protège aussi les insertions concurrentes de zones qui se chevauchent. */
    @Transactional(isolation = Isolation.SERIALIZABLE)
    public ZoneVue enregistrer(Long id, ZoneRequest r) {
        if (r == null || r.nom() == null || r.nom().isBlank() || r.nom().trim().length() > 100)
            throw new IllegalArgumentException("Nom de zone obligatoire (100 caractères maximum).");
        BigDecimal frais = argent(r.fraisLivraison(), true);
        Double vitesse = r.vitesseMoyenneKmh();
        if (vitesse != null && (!Double.isFinite(vitesse) || vitesse < VITESSE_MIN_KMH || vitesse > VITESSE_MAX_KMH))
            throw new IllegalArgumentException("Vitesse moyenne : de " + (int) VITESSE_MIN_KMH + " à " + (int) VITESSE_MAX_KMH + " km/h.");
        Polygon poly = polygone(r.polygone());
        for (Zone autre : zones.findAllByOrderByIdAsc()) {
            if (!autre.getId().equals(id) && poly.getEnvelopeInternal().intersects(autre.getPolygone().getEnvelopeInternal())
                    && poly.intersection(autre.getPolygone()).getArea() > 1e-12)
                throw new IllegalArgumentException("La zone chevauche « " + autre.getNom() + " ». Les frontières communes sont autorisées.");
        }
        Zone z = id == null ? new Zone() : zones.findById(id).orElseThrow(MarketplaceException::absent);
        BigDecimal anciensFrais = z.getFraisLivraison();
        z.setNom(r.nom().trim()); z.definirPolygone(poly); z.setFraisLivraison(frais);
        if (vitesse != null) z.setVitesseMoyenneKmh(vitesse);
        zones.saveAndFlush(z);
        // L'emplacement enregistré du commerce détermine son rattachement, jamais une zone arbitraire.
        for (Partenaire p : partenaires.findAll().stream().sorted(Comparator.comparing(Partenaire::getId)).toList()) {
            entityManager.refresh(p, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
            rattacher(p);
        }
        audit.enregistrer(id == null ? ActionAudit.ZONE_CREEE : ActionAudit.ZONE_MODIFIEE, "ZONE", z.getId(), z.getNom());
        if (anciensFrais != null && anciensFrais.compareTo(frais) != 0)
            audit.enregistrer(ActionAudit.FRAIS_ZONE_MODIFIES, "ZONE", z.getId(), anciensFrais + " → " + frais + " DT");
        return ZoneVue.from(z, partenaires.findAll().stream().filter(p -> p.getZone() != null && p.getZone().getId().equals(z.getId())).count(),
                voisines(z, zones.findAllByOrderByIdAsc()));
    }
    public void rattacher(Partenaire p) {
        p.setZone(p.getLatitude() == null || p.getLongitude() == null ? null : trouver(p.getLatitude(), p.getLongitude()).orElse(null));
        if (p.getZone() == null) p.setOuvert(false);
    }
    @Transactional(isolation = Isolation.SERIALIZABLE)
    public void supprimer(Long id) {
        Zone z = zones.findById(id).orElseThrow(MarketplaceException::absent);
        if (partenaires.findAll().stream().anyMatch(p -> p.getZone() != null && p.getZone().getId().equals(id)))
            throw MarketplaceException.conflit("Cette zone couvre des partenaires. Modifiez sa couverture avant de la supprimer.");
        if (affectations.existsByZoneId(id))
            throw MarketplaceException.conflit("Des livreurs sont affectés à cette zone. Retirez leurs affectations avant de la supprimer.");
        audit.enregistrer(ActionAudit.ZONE_SUPPRIMEE, "ZONE", id, z.getNom());
        zones.delete(z);
    }
    public static BigDecimal argent(BigDecimal valeur, boolean zero) {
        if (valeur == null || valeur.scale() > 3 || valeur.compareTo(BigDecimal.ZERO) < (zero ? 0 : 1)
                || valeur.compareTo(new BigDecimal("100000")) > 0)
            throw new IllegalArgumentException("Montant invalide (maximum 100000 DT, 3 décimales ; prix strictement positif).");
        return valeur.setScale(3, RoundingMode.UNNECESSARY);
    }
}
