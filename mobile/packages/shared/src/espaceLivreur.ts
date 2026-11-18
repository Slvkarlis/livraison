// Sprint 2 bis (US-2B8) : application coursier, miroir de EspaceLivreurDto.java.
import type { StatutLivraison } from './types';
import type { Position } from './sprint2';
import type { PositionEnvoyee } from './suivi';

export type TypeAffectation = 'PRINCIPALE' | 'SECONDAIRE' | 'TEMPORAIRE';
export interface ZoneAutorisee { nom: string; type: TypeAffectation; enVigueur: boolean }
export interface Disponibilite { disponible: boolean; miseAJourLe: string | null; zones: ZoneAutorisee[] }

/** Mission : adresse du commerce ; du client, le prenom et la zone, puis l'adresse de livraison une fois le colis collecte. */
export interface Mission {
  id: number; codeSuivi: string; statut: StatutLivraison;
  nomCommerce: string; adresseCommerce: string; latitudeCommerce: number | null; longitudeCommerce: number | null;
  zoneNom: string | null; clientPrenom: string; nbArticles: number; montantACollecter: number;
  preteLe: string | null; affecteeLe: string | null; recupereeLe: string | null;
  /** US-301 : connus seulement apres la collecte. */
  adresseLivraison: string | null; latitudeLivraison: number | null; longitudeLivraison: number | null;
  /** US-306 : remise validee. */
  livreeLe: string | null; montantEncaisse: number | null;
}

export const LIBELLES_AFFECTATION: Record<TypeAffectation, string> = {
  PRINCIPALE: 'Zone principale', SECONDAIRE: 'Zone secondaire', TEMPORAIRE: 'Renfort',
};

/** Zones ou le coursier peut travailler en ce moment (un renfort hors de sa periode n'en fait pas partie). */
export function zonesEnVigueur(d: Disponibilite): ZoneAutorisee[] {
  return d.zones.filter((z) => z.enVigueur);
}

export function creerApiLivreur(request: <T>(method: string, path: string, body?: unknown) => Promise<T>) {
  return {
    disponibilite: () => request<Disponibilite>('GET', '/api/livreur/disponibilite'),
    seDeclarerDisponible: (position: Position) =>
      request<Disponibilite>('PUT', '/api/livreur/disponibilite', { disponible: true, ...position }),
    seDeclarerIndisponible: () => request<Disponibilite>('PUT', '/api/livreur/disponibilite', { disponible: false }),
    missions: () => request<Mission[]>('GET', '/api/livreur/missions'),
    missionsLivrees: () => request<Mission[]>('GET', '/api/livreur/missions/livrees'),
    mission: (id: number) => request<Mission>('GET', '/api/livreur/missions/' + id),
    /** US-2B9 : code = contenu du QR scanne, ou code de collecte saisi a la main. */
    confirmerCollecte: (id: number, code: string) => request<Mission>('POST', '/api/livreur/missions/' + id + '/collecte', { code }),
    /** US-306 : preuve = contenu du QR du client, ou code a 6 chiffres recu par SMS. */
    validerRemise: (id: number, montantEncaisse: number, motifEcart: string | null, preuve: string) =>
      request<Mission>('POST', '/api/livreur/missions/' + id + '/remise', { montantEncaisse, motifEcart, preuve }),
    /** US-301 : precision en metres, telle que donnee par le GPS du telephone. */
    envoyerPosition: (position: Position, precision?: number | null) =>
      request<PositionEnvoyee>('PUT', '/api/livreur/position', { ...position, precision: precision ?? null }),
  };
}
