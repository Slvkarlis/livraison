package com.fleetpulse.livraison.Dto;
import java.util.List;
import org.springframework.data.domain.Page;
public record PageAuditResponse(List<JournalAuditResponse> content, int number, int totalPages, long totalElements) {
    public static PageAuditResponse from(Page<JournalAuditResponse> page) {
        return new PageAuditResponse(page.getContent(), page.getNumber(), page.getTotalPages(), page.getTotalElements());
    }
}
