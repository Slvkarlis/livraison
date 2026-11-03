package com.fleetpulse.livraison.Model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import org.locationtech.jts.geom.*;

@Entity @Getter @Setter @NoArgsConstructor
@Table(indexes = @Index(name = "idx_zone_enveloppe", columnList = "minLongitude,maxLongitude,minLatitude,maxLatitude"))
public class Zone {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false, length = 100) private String nom;
    @Convert(converter = PolygoneConverter.class) @Column(nullable = false, columnDefinition = "text")
    private Polygon polygone;
    @Column(nullable = false, precision = 14, scale = 3) private BigDecimal fraisLivraison;
    private double minLatitude, maxLatitude, minLongitude, maxLongitude;
    public void definirPolygone(Polygon p) {
        polygone = p;
        Envelope e = p.getEnvelopeInternal();
        minLatitude = e.getMinY(); maxLatitude = e.getMaxY();
        minLongitude = e.getMinX(); maxLongitude = e.getMaxX();
    }
    /** Frontières incluses ; les zones adjacentes restent desservies. */
    public boolean contient(double latitude, double longitude) {
        if (!Double.isFinite(latitude) || !Double.isFinite(longitude)) return false;
        return polygone.getEnvelopeInternal().contains(longitude, latitude)
                && polygone.covers(polygone.getFactory().createPoint(new Coordinate(longitude, latitude)));
    }
}
