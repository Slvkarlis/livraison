package com.fleetpulse.livraison.Model;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import org.locationtech.jts.geom.Polygon;
import org.locationtech.jts.io.WKTReader;

@Converter
public class PolygoneConverter implements AttributeConverter<Polygon, String> {
    public String convertToDatabaseColumn(Polygon geometry) { return geometry == null ? null : geometry.toText(); }
    public Polygon convertToEntityAttribute(String wkt) {
        if (wkt == null) return null;
        try { return (Polygon) new WKTReader().read(wkt); }
        catch (Exception e) { throw new IllegalStateException("Polygone enregistré invalide", e); }
    }
}
