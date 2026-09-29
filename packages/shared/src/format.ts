import type { StatutLivraison } from './types';

export const STATUTS: Record<StatutLivraison, { libelle: string; couleur: string; fond: string }> = {
  EN_PREPARATION: { libelle: 'En préparation', couleur: '#B45309', fond: '#FEF3C7' },
  AFFECTEE: { libelle: 'Livreur assigné', couleur: '#1D4ED8', fond: '#DBEAFE' },
  EN_COURS: { libelle: 'En route', couleur: '#6D28D9', fond: '#EDE9FE' },
  A_PROXIMITE: { libelle: 'À proximité', couleur: '#6D28D9', fond: '#EDE9FE' },
  ARRIVEE: { libelle: 'Livreur arrivé', couleur: '#0F766E', fond: '#CCFBF1' },
  LIVREE: { libelle: 'Livrée', couleur: '#15803D', fond: '#DCFCE7' },
  ECHEC: { libelle: 'Échec', couleur: '#B91C1C', fond: '#FEE2E2' },
  RETOURNEE: { libelle: 'Retournée', couleur: '#4B5563', fond: '#F3F4F6' },
};

export const MODES_PAIEMENT = { COD: 'Paiement à la livraison' } as const;

export const TYPES_LIVRAISON = { IMMEDIATE: 'Immédiate', PLANIFIEE: 'Créneau planifié' } as const;

export function formatDistance(km: number): string {
  return `${km.toFixed(1).replace('.', ',')} km`;
}

export function formatMontant(montant: number): string {
  return `${montant.toFixed(1).replace('.', ',')} DT`;
}

function deuxChiffres(n: number) {
  return n.toString().padStart(2, '0');
}

export function formatHeure(date: Date): string {
  return `${deuxChiffres(date.getHours())}:${deuxChiffres(date.getMinutes())}`;
}

const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export function formatJour(date: Date): string {
  const aujourdhui = new Date();
  const demain = new Date();
  demain.setDate(aujourdhui.getDate() + 1);
  if (date.toDateString() === aujourdhui.toDateString()) return "Aujourd'hui";
  if (date.toDateString() === demain.toDateString()) return 'Demain';
  return `${JOURS[date.getDay()]} ${date.getDate()} ${MOIS[date.getMonth()]}`;
}

export function formatCreneau(debutIso: string, finIso: string): string {
  const debut = new Date(debutIso);
  return `${formatJour(debut)}, ${formatHeure(debut)} – ${formatHeure(new Date(finIso))}`;
}
