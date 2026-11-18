package com.fleetpulse.livraison.Service;

import com.fleetpulse.livraison.Dto.BiDto.*;
import com.fleetpulse.livraison.Model.enums.TypeEcriture;
import com.fleetpulse.livraison.Repository.BiRepository;
import java.math.BigDecimal;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @RequiredArgsConstructor @Transactional(readOnly = true)
public class BiFinanceService {
    private final BiRepository agregats;
    private final CaisseService caisses;
    private final ClosingService closings;

    public FinanceVue dashboard(PeriodeBi periode) {
        Map<TypeEcriture, BigDecimal> sommes = new EnumMap<>(TypeEcriture.class);
        for (Object[] r : agregats.ledger(periode)) sommes.put((TypeEcriture) r[0], argent(r[1]));
        var attente = closings.attentesBi(periode);
        BigDecimal gmv = somme(sommes, TypeEcriture.GMV);
        return new FinanceVue(periode, gmv, gmv, somme(sommes, TypeEcriture.COMMISSION),
                somme(sommes, TypeEcriture.FRAIS_LIVRAISON).subtract(somme(sommes, TypeEcriture.REMUNERATION_COURSIER)),
                caisses.soldeBi(periode), attente.reversements(), attente.remunerations(),
                somme(sommes, TypeEcriture.REVERSEMENT_PARTENAIRE), somme(sommes, TypeEcriture.PAIEMENT_COURSIER), agregats.articles(periode));
    }

    public static BigDecimal argent(Object valeur) {
        return CalculsFinanciers.argent(valeur == null ? null : new BigDecimal(valeur.toString()));
    }
    private static BigDecimal somme(Map<TypeEcriture, BigDecimal> sommes, TypeEcriture type) {
        return sommes.getOrDefault(type, BigDecimal.ZERO.setScale(3));
    }
}
