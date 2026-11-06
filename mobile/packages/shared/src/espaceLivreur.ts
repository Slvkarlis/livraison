// Sprint 2 bis (US-2B8) : application coursier, miroir de EspaceLivreurDto.java.
import type { StatutLivraison } from './types';
import type { Position } from './sprint2';

export type TypeAffectation = 'PRINCIPALE' | 'SECONDAIRE' | 'TEMPORAIRE';
export interface ZoneAutorisee { nom: string; type: TypeAffectation; enVigueur: boolean }
export interface Disponibilite { disponible: boolean; miseAJourLe: string | null; zones: ZoneAutorisee[] }

/** Mission de collecte : adresse du commerce ; du client, seulement le prenom et la zone. */
export interface Mission {
  id: number; codeSuivi: string; statut: StatutLivraison;
  nomCommerce: string; adresseCommerce: string; latitudeCommerce: number | null; longitudeCommerce: number | null;
  zoneNom: string | null; clientPrenom: string; nbArticles: number; montantACollecter: number;
  preteLe: string | null; affecteeLe: string | null;
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
    mission: (id: number) => request<Mission>('GET', '/api/livreur/missions/' + id),
  };
}
