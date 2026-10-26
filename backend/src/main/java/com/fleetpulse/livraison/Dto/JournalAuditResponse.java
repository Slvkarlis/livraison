package com.fleetpulse.livraison.Dto;

import com.fleetpulse.livraison.Model.JournalAudit;
import com.fleetpulse.livraison.Model.enums.ActionAudit;
import java.time.Instant;

public record JournalAuditResponse(
        Long id, Instant date, String acteur, ActionAudit action, String cibleType, Long cibleId, String details) {

    public static JournalAuditResponse from(JournalAudit j) {
        return new JournalAuditResponse(
                j.getId(), j.getDate(), j.getActeur(), j.getAction(), j.getCibleType(), j.getCibleId(), j.getDetails());
    }
}
