import type { ModePaiement, StatutLivraison, StatutPaiement, TypeLivraison } from './types';

export const STATUTS: Record<StatutLivraison, { libelle: string; couleur: string; fond: string }> = {
  PENDING_PARTNER: { libelle: 'En attente du partenaire', couleur: '#B45309', fond: '#FEF3C7' },
  ACCEPTEE: { libelle: 'Acceptée', couleur: '#0369A1', fond: '#E0F2FE' },
  REFUSEE: { libelle: 'Refusée', couleur: '#B91C1C', fond: '#FEE2E2' },
  EN_PREPARATION: { libelle: 'En préparation', couleur: '#B45309', fond: '#FEF3C7' },
  PRETE: { libelle: 'Prête', couleur: '#047857', fond: '#D1FAE5' },
  AFFECTEE: { libelle: 'Livreur assigné', couleur: '#1D4ED8', fond: '#DBEAFE' },
  RECUPEREE: { libelle: 'Récupérée', couleur: '#6D28D9', fond: '#EDE9FE' },
  ANNULEE: { libelle: 'Annulée', couleur: '#4B5563', fond: '#F3F4F6' },
  EN_COURS: { libelle: 'En route', couleur: '#6D28D9', fond: '#EDE9FE' },
  A_PROXIMITE: { libelle: 'À proximité', couleur: '#6D28D9', fond: '#EDE9FE' },
  ARRIVEE: { libelle: 'Livreur arrivé', couleur: '#0F766E', fond: '#CCFBF1' },
  LIVREE: { libelle: 'Livrée', couleur: '#15803D', fond: '#DCFCE7' },
  ECHEC: { libelle: 'Échec', couleur: '#B91C1C', fond: '#FEE2E2' },
  RETOURNEE: { libelle: 'Retournée', couleur: '#4B5563', fond: '#F3F4F6' },
};

export const MODES_PAIEMENT: Record<ModePaiement, string> = { COD: 'Espèces', CARTE: 'Carte' };

export const STATUTS_PAIEMENT: Record<StatutPaiement, string> = {
  A_LA_LIVRAISON: 'À régler au livreur',
  EN_ATTENTE: 'Paiement en attente',
  PAYE: 'Payée par carte',
  ECHOUE: 'Paiement échoué',
};

export const TYPES_LIVRAISON: Record<TypeLivraison, string> = { IMMEDIATE: 'Immédiate', PLANIFIEE: 'Planifiée' };

export function formatMontant(montant: number) {
  return `${montant.toFixed(3).replace('.', ',')} DT`;
}

export function formatDistance(km: number) {
  return `${km.toFixed(1).replace('.', ',')} km`;
}

const dateHeure = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
const heure = new Intl.DateTimeFormat('fr-FR', { timeStyle: 'short' });

export function formatDate(iso: string) {
  return dateHeure.format(new Date(iso));
}

export function formatCreneau(debut: string | null, fin: string | null) {
  if (!debut || !fin) return '—';
  return `${dateHeure.format(new Date(debut))} – ${heure.format(new Date(fin))}`;
}

export function formatNombre(n: number) {
  return n.toLocaleString('fr-FR');
}
