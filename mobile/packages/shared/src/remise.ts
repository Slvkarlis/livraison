// Sprint 3 : remise du colis au client (US-305, US-306, US-310), miroir de RemiseDto.java.
import type { StatutLivraison } from './types';

export interface QrRemise { contenuQr: string; expireLe: string }
export interface CodeRemiseEnvoye { destination: string; prochainEnvoiPossibleLe: string | null }

/** Le client peut montrer son QR (ou demander un code) quand le colis est a bord. */
export function peutValiderRemise(statut: StatutLivraison): boolean {
  return statut === 'RECUPEREE' || statut === 'A_PROXIMITE';
}

/** Marge avant expiration : le QR est renouvele avant que le livreur ne tombe sur un QR expire. */
const MARGE_RENOUVELLEMENT_MS = 20_000;
/** Delai avant de redemander un QR (au moins 5 s, meme si l'horloge du telephone est decalee). */
export function delaiRenouvellementQr(expireLe: string, maintenant: Date = new Date()): number {
  return Math.max(5_000, new Date(expireLe).getTime() - maintenant.getTime() - MARGE_RENOUVELLEMENT_MS);
}

/** Montant saisi par le coursier (« 14,5 » accepte) : null si illisible, negatif ou plus de 3 decimales. */
export function lireMontant(saisie: string): number | null {
  const texte = saisie.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,3})?$/.test(texte)) return null;
  return Number(texte);
}

/** Ecart encaisse - total, en millimes pour eviter les erreurs d'arrondi ; un ecart non nul exige un motif. */
export function ecartEncaissement(encaisse: number, attendu: number): number {
  return (Math.round(encaisse * 1000) - Math.round(attendu * 1000)) / 1000;
}

export function creerApiRemiseClient(request: <T>(method: string, path: string, body?: unknown) => Promise<T>) {
  return {
    qrRemise: (id: number) => request<QrRemise>('GET', '/api/commandes/' + id + '/qr-remise'),
    demanderCodeRemise: (id: number) => request<CodeRemiseEnvoye>('POST', '/api/commandes/' + id + '/code-remise'),
  };
}
