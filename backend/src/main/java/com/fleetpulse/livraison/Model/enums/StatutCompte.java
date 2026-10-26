package com.fleetpulse.livraison.Model.enums;

/**
 * EN_ATTENTE : dossier soumis (partenaire, candidat livreur), en attente de decision du Responsable.
 * COMPLEMENT_DEMANDE : le Responsable attend des pieces ou corrections avant de decider.
 * ACTIF : compte utilisable. SUSPENDU : bloque par le Responsable (motif trace). REFUSE : dossier rejete.
 */
public enum StatutCompte { EN_ATTENTE, COMPLEMENT_DEMANDE, ACTIF, SUSPENDU, REFUSE }
