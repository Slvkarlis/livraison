/** Sprint 7 et 8 cote mobile : echec de livraison (coursier), pause de boutique (partenaire), reclamation (client). */

type Requete = <T>(method: string, path: string, body?: unknown) => Promise<T>;

export type MotifEchec = 'INJOIGNABLE' | 'REFUS_MARCHANDISE' | 'REFUS_PAIEMENT' | 'ADRESSE_INTROUVABLE' | 'INCIDENT';
export type TypeReclamation = 'QUALITE' | 'MANQUANT' | 'RETARD' | 'AUTRE';

export const LIBELLES_MOTIF_ECHEC: Record<MotifEchec, string> = {
  INJOIGNABLE: 'Client injoignable',
  REFUS_MARCHANDISE: 'Le client refuse la commande',
  REFUS_PAIEMENT: 'Le client refuse de payer',
  ADRESSE_INTROUVABLE: 'Adresse introuvable',
  INCIDENT: 'Autre incident',
};

export type BoutiqueEtat = {
  ouvert: boolean;
  acceptePourCommandes: boolean;
  pauseJusqua: string | null;
  expirationsConsecutives: number;
  horaires: { ouverture: string | null; fermeture: string | null; jours: number[] } | null;
};

export function creerApiSprintSept(request: Requete) {
  return {
    declarerEchec: (missionId: number, motif: MotifEchec, commentaire: string) =>
      request<void>('POST', `/api/livreur/missions/${missionId}/echec`, { motif, commentaire }),
    boutique: () => request<BoutiqueEtat>('GET', '/api/partenaire/boutique'),
    pauseBoutique: (minutes: number) => request<BoutiqueEtat>('POST', '/api/partenaire/boutique/pause', { minutes }),
    reprendreBoutique: () => request<BoutiqueEtat>('DELETE', '/api/partenaire/boutique/pause'),
    ouvrirReclamation: (commandeId: number, type: TypeReclamation, description: string, montantDemande: number) =>
      request<{ id: number }>('POST', '/api/reclamations', { commandeId, type, description, montantDemande }),
  };
}
