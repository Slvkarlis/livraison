// Sprint 3 : suivi GPS du coursier (US-301) et de la livraison par le client (US-302, US-303).
import type { Position } from './sprint2';
import type { StatutLivraison } from './types';

/** Miroir de PositionVue.java : acceptee false = point ecarte par le serveur (imprecis ou saut GPS). */
export interface PositionEnvoyee { acceptee: boolean; raison: string | null; date: string | null; enMission: boolean }

/** Missions pendant lesquelles l'application transmet la position (miroir de MISSIONS_EN_COURS). */
export const STATUTS_MISSION_EN_COURS: StatutLivraison[] = ['AFFECTEE', 'RECUPEREE', 'A_PROXIMITE'];
/** Colis a bord, en route vers le client : le client voit le coursier sur la carte. */
export const STATUTS_EN_ROUTE: StatutLivraison[] = ['RECUPEREE', 'A_PROXIMITE'];

export function enMission(statuts: StatutLivraison[]): boolean {
  return statuts.some((s) => STATUTS_MISSION_EN_COURS.includes(s));
}

/**
 * Compromis precision / batterie (cahier des charges §4.3) : un point toutes les 10 s,
 * ou des 25 m parcourus, pendant les missions uniquement.
 */
export const SUIVI_GPS = { intervalleMs: 10_000, distanceMetres: 25 } as const;

/** Distance a vol d'oiseau en km (haversine), identique a Distances.java. */
export function distanceKm(a: Position, b: Position): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.latitude - a.latitude) / 2) ** 2
    + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Mode demonstration : points reguliers de depart vers arrivee (arrivee incluse, depart exclu),
 * espaces d'au plus pasMetres, pour simuler un trajet sans se deplacer.
 */
export function pointsTrajet(depart: Position, arrivee: Position, pasMetres = 50): Position[] {
  const etapes = Math.max(1, Math.ceil((distanceKm(depart, arrivee) * 1000) / pasMetres));
  return Array.from({ length: etapes }, (_, i) => {
    const t = (i + 1) / etapes;
    return {
      latitude: depart.latitude + (arrivee.latitude - depart.latitude) * t,
      longitude: depart.longitude + (arrivee.longitude - depart.longitude) * t,
    };
  });
}

/** Miroir de SuiviCommandeVue.java. livreur : connu seulement une fois le colis a bord. */
export interface SuiviCommande {
  commandeId: number; statut: StatutLivraison; livreurPrenom: string | null;
  livreur: { latitude: number; longitude: number; date: string | null } | null;
  commerce: Position | null; destination: Position;
  pretePrevueLe: string | null; arriveeEstimee: string | null;
}
/** Message temps reel /user/queue/positions (miroir de PositionCommande.java). */
export interface PositionCommande { commandeId: number; latitude: number; longitude: number; date: string; arriveeEstimee: string | null }

/** Statuts pour lesquels le client consulte le suivi (ETA et, colis a bord, position du coursier). */
export const STATUTS_SUIVIS: StatutLivraison[] = ['ACCEPTEE', 'EN_PREPARATION', 'PRETE', 'AFFECTEE', 'RECUPEREE', 'A_PROXIMITE'];

/** US-303 : « Arrivée estimée vers 14:35 · dans 12 min ». */
export function messageArrivee(arriveeEstimee: string | null, maintenant: Date = new Date()): string | null {
  if (!arriveeEstimee) return null;
  const arrivee = new Date(arriveeEstimee);
  const minutes = Math.round((arrivee.getTime() - maintenant.getTime()) / 60000);
  const heure = `${String(arrivee.getHours()).padStart(2, '0')}:${String(arrivee.getMinutes()).padStart(2, '0')}`;
  if (minutes <= 1) return `Arrivée imminente (vers ${heure})`;
  return `Arrivée estimée vers ${heure} · dans ${minutes} min`;
}

export function lirePositionCommande(corps: string): PositionCommande | null {
  try {
    const p = JSON.parse(corps) as Partial<PositionCommande>;
    return typeof p.commandeId === 'number' && typeof p.latitude === 'number' && typeof p.longitude === 'number'
      ? { commandeId: p.commandeId, latitude: p.latitude, longitude: p.longitude, date: p.date ?? '', arriveeEstimee: p.arriveeEstimee ?? null }
      : null;
  } catch {
    return null;
  }
}

export function creerApiSuivi(request: <T>(method: string, path: string, body?: unknown) => Promise<T>) {
  return {
    suiviCommande: (id: number) => request<SuiviCommande>('GET', '/api/commandes/' + id + '/suivi'),
  };
}
