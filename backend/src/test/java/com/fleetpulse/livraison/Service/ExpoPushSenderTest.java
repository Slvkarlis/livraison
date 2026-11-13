package com.fleetpulse.livraison.Service;

import static org.junit.jupiter.api.Assertions.*;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ExpoPushSenderTest {
    @Test void jetonsDesinstallesReperesDansLesTickets() {
        Map<String, Object> reponse = Map.of("data", List.of(
                Map.of("status", "ok", "id", "a"),
                Map.of("status", "error", "message", "x", "details", Map.of("error", "DeviceNotRegistered")),
                Map.of("status", "error", "message", "y", "details", Map.of("error", "MessageRateExceeded"))));
        assertEquals(List.of("J2"), ExpoPushSender.jetonsInvalides(List.of("J1", "J2", "J3"), reponse));
        assertEquals(List.of(), ExpoPushSender.jetonsInvalides(List.of("J1"), Map.of("errors", List.of())));
        assertEquals(List.of(), ExpoPushSender.jetonsInvalides(List.of("J1"), null));
    }

    @Test void desactiveParDefautRienNEstEnvoye() {
        assertEquals(List.of(), new ExpoPushSender(false, "").envoyer(List.of("ExponentPushToken[x]"), "t", "m", Map.of()));
    }
}
