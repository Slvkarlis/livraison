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

export function creerApiRemiseClient(request: <T>(method: string, path: string, body?: unknown) => Promise<T>) {
  return {
    qrRemise: (id: number) => request<QrRemise>('GET', '/api/commandes/' + id + '/qr-remise'),
    demanderCodeRemise: (id: number) => request<CodeRemiseEnvoye>('POST', '/api/commandes/' + id + '/code-remise'),
  };
}
