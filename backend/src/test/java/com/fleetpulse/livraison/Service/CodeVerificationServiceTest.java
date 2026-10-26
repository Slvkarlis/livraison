package com.fleetpulse.livraison.Service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fleetpulse.livraison.Model.CodeVerification;
import com.fleetpulse.livraison.Model.enums.TypeCode;
import com.fleetpulse.livraison.Repository.CodeVerificationRepository;
import com.fleetpulse.livraison.Service.CodeVerificationService.TropDeDemandesException;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

class CodeVerificationServiceTest {
    private static final String TEL = "22123456";

    private final CodeVerificationRepository repository = mock(CodeVerificationRepository.class);
    private final CodeVerificationService service = new CodeVerificationService();
    private CodeVerification enregistre;

    @BeforeEach
    void configurer() {
        ReflectionTestUtils.setField(service, "repository", repository);
        ReflectionTestUtils.setField(service, "passwordEncoder", new BCryptPasswordEncoder(4));
        ReflectionTestUtils.setField(service, "dureeMinutes", 10L);
        ReflectionTestUtils.setField(service, "tentativesMax", 3);
        ReflectionTestUtils.setField(service, "delaiRenvoiSecondes", 60L);
        when(repository.findFirstByCibleAndTypeOrderByCreeLeDesc(TEL, TypeCode.INSCRIPTION))
                .thenAnswer(invocation -> Optional.ofNullable(enregistre));
        when(repository.save(any())).thenAnswer(invocation -> enregistre = invocation.getArgument(0));
    }

    @Test
    void codeASixChiffresAUsageUnique() {
        String code = service.generer(TEL, TypeCode.INSCRIPTION);

        assertTrue(code.matches("\\d{6}"));
        assertTrue(service.verifier(TEL, TypeCode.INSCRIPTION, code));
        assertFalse(service.verifier(TEL, TypeCode.INSCRIPTION, code));
    }

    @Test
    void lesEssaisSontLimites() {
        String code = service.generer(TEL, TypeCode.INSCRIPTION);
        String faux = code.equals("000000") ? "111111" : "000000";

        for (int i = 0; i < 3; i++) assertFalse(service.verifier(TEL, TypeCode.INSCRIPTION, faux));
        assertEquals(3, enregistre.getTentatives());
        assertFalse(service.verifier(TEL, TypeCode.INSCRIPTION, code));
    }

    @Test
    void unCodeExpireEstRefuse() {
        String code = service.generer(TEL, TypeCode.INSCRIPTION);
        enregistre.setExpireLe(Instant.now().minusSeconds(1));
        assertFalse(service.verifier(TEL, TypeCode.INSCRIPTION, code));
    }

    @Test
    void unNouveauCodeNePeutPasEtreDemandeImmediatement() {
        service.generer(TEL, TypeCode.INSCRIPTION);
        assertThrows(TropDeDemandesException.class, () -> service.generer(TEL, TypeCode.INSCRIPTION));

        enregistre.setCreeLe(Instant.now().minusSeconds(61));
        service.generer(TEL, TypeCode.INSCRIPTION);
    }
}
