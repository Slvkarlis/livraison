package com.fleetpulse.livraison.Service;
import com.fleetpulse.livraison.Dto.MarketplaceDto.Position;
import com.fleetpulse.livraison.Model.Zone;
import java.util.List;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ZoneServiceTest {
    private Zone zone() { Zone z = new Zone(); z.definirPolygone(ZoneService.polygone(List.of(new Position(0.,0.),new Position(0.,1.),new Position(1.,1.),new Position(1.,0.)))); return z; }
    @Test void pointInterieurExterieurEtFrontieres() { Zone z = zone(); assertTrue(z.contient(.5,.5)); assertTrue(z.contient(0,0)); assertTrue(z.contient(.5,1)); assertFalse(z.contient(2,.5)); assertFalse(z.contient(Double.NaN,0)); }
    @Test void polygoneConcave() { Zone z = new Zone(); z.definirPolygone(ZoneService.polygone(List.of(new Position(0.,0.),new Position(0.,2.),new Position(1.,1.),new Position(2.,2.),new Position(2.,0.)))); assertFalse(z.contient(1,1.8)); assertTrue(z.contient(1,.5)); }
    @Test void refuseCroisementsAlignementsEtCoordonneesInvalides() {
        assertThrows(IllegalArgumentException.class, () -> ZoneService.polygone(List.of(new Position(0.,0.),new Position(1.,1.),new Position(0.,1.),new Position(1.,0.))));
        assertThrows(IllegalArgumentException.class, () -> ZoneService.polygone(List.of(new Position(0.,0.),new Position(1.,1.),new Position(2.,2.))));
        assertThrows(IllegalArgumentException.class, () -> ZoneService.position(91., 0.));
        assertThrows(IllegalArgumentException.class, () -> ZoneService.position(0., Double.POSITIVE_INFINITY));
    }
    @Test void pointDansZoneSous200msApresChauffe() {
        Zone z = zone(); for (int i=0;i<2000;i++) z.contient(.5,.5);
        long debut=System.nanoTime(); assertTrue(z.contient(.4,.4)); long temps=System.nanoTime()-debut;
        System.out.println("Point dans zone JTS : " + temps/1000 + " microsecondes"); assertTrue(temps < 200_000_000L);
    }
}
