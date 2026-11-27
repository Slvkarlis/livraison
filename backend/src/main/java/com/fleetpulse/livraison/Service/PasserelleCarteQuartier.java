package com.fleetpulse.livraison.Service;

import java.math.BigDecimal;

/** Port testé sans clé réelle ; le client ne peut jamais déclarer lui-même un paiement réussi. */
public interface PasserelleCarteQuartier {
    record Session(String id, String url) { }
    record Autorisation(String intentionId, String statut, BigDecimal montant, String devise, BigDecimal encaisse) {
        public Autorisation(String intentionId, String statut, BigDecimal montant, String devise) { this(intentionId, statut, montant, devise, null); }
    }
    boolean active();
    Session ouvrir(Long commandeId, BigDecimal montant);
    Autorisation verifier(String sessionId);
    void capturer(String intentionId, BigDecimal montant, Long commandeId);
    void annuler(String sessionId, Long commandeId);
}
