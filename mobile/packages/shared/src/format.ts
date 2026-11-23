import type { StatutLivraison } from './types';

// Palette de la refonte : ambre = en attente / en cours chez le commerce, graphite = colis en mouvement,
// vert = pret ou livre, rouge = echec, gris = clos sans livraison.
const ATTENTE = { couleur: '#7A4D00', fond: '#FDF3DC' };
const PRIS = { couleur: '#15171A', fond: '#ECEBE7' };
const MOUVEMENT = { couleur: '#F2B233', fond: '#1B1C1F' };
const SUCCES = { couleur: '#1F6F43', fond: '#E3F4EC' };
const DANGER = { couleur: '#C8312B', fond: '#FBE9E7' };
const NEUTRE = { couleur: '#6B6F76', fond: '#ECEBE7' };

export const STATUTS: Record<StatutLivraison, { libelle: string; couleur: string; fond: string }> = {
  PENDING_PARTNER: { libelle: 'En attente du partenaire', ...ATTENTE },
  ACCEPTEE: { libelle: 'Acceptée', ...PRIS },
  REFUSEE: { libelle: 'Refusée', ...DANGER },
  EN_PREPARATION: { libelle: 'En préparation', ...ATTENTE },
  PRETE: { libelle: 'Prête', ...SUCCES },
  AFFECTEE: { libelle: 'Livreur assigné', ...PRIS },
  RECUPEREE: { libelle: 'Récupérée', ...MOUVEMENT },
  ANNULEE: { libelle: 'Annulée', ...NEUTRE },
  EN_COURS: { libelle: 'En route', ...MOUVEMENT },
  A_PROXIMITE: { libelle: 'À proximité', ...MOUVEMENT },
  ARRIVEE: { libelle: 'Livreur arrivé', ...MOUVEMENT },
  LIVREE: { libelle: 'Livrée', ...SUCCES },
  ECHEC: { libelle: 'Échec', ...DANGER },
  RETOURNEE: { libelle: 'Retournée', ...NEUTRE },
};

export const MODES_PAIEMENT = { COD: 'Paiement à la livraison', CARTE: 'Carte bancaire' } as const;

export const STATUTS_PAIEMENT = {
  A_LA_LIVRAISON: { libelle: 'À régler au livreur', couleur: '#6B6F76' },
  ENCAISSE: { libelle: 'Réglée au livreur', couleur: '#1F6F43' },
  EN_ATTENTE: { libelle: 'Paiement en attente', couleur: '#7A4D00' },
  PAYE: { libelle: 'Payée par carte', couleur: '#1F6F43' },
  ECHOUE: { libelle: 'Paiement échoué', couleur: '#C8312B' },
} as const;

export const TYPES_LIVRAISON = { IMMEDIATE: 'Immédiate', PLANIFIEE: 'Créneau planifié' } as const;

export function formatDistance(km: number): string {
  return `${km.toFixed(1).replace('.', ',')} km`;
}

export function formatMontant(montant: number): string {
  return `${montant.toFixed(3).replace('.', ',')} DT`;
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
