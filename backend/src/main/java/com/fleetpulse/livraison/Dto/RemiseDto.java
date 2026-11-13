package com.fleetpulse.livraison.Dto;

import java.time.Instant;

/** Remise du colis au client (US-305, US-310). */
public final class RemiseDto {
    private RemiseDto() { }

    /** contenuQr : a encoder tel quel dans le QR ; l'application en redemande un avant expireLe. */
    public record QrRemiseVue(String contenuQr, Instant expireLe) { }

    /** destination : ou le code a ete envoye (numero masque) ; prochainEnvoiPossibleLe null : plus de renvoi possible. */
    public record CodeRemiseEnvoye(String destination, Instant prochainEnvoiPossibleLe) { }
}
