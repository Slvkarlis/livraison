// Itineraire routier (comme un GPS) : livreur -> commerce -> client, en suivant les rues.
// Calcul par OSRM (donnees OpenStreetMap, sans cle). Si le livreur s'ecarte du trace, l'itineraire est recalcule
// depuis sa nouvelle position. Sans reseau : repli en ligne droite, signale par source = 'direct'.
// Module sans dependance React Native : utilise aussi par le web responsable.

/** [longitude, latitude], ordre GeoJSON. */
export type Coord = [number, number];

export interface Manoeuvre { instruction: string; distanceM: number; point: Coord }

export interface ItineraireRoutier {
  /** Trace complet, du depart au dernier arret. */
  points: Coord[];
  /** Distance cumulee (km) a chaque point du trace. */
  cumuls: number[];
  /** Arrets demandes (sans le depart) et index du point du trace le plus proche de chacun. */
  arrets: Coord[];
  indexArrets: number[];
  distanceKm: number;
  dureeMin: number;
  etapes: Manoeuvre[];
  source: 'osrm' | 'direct';
  calculeLe: number;
}

/** Ecart au-dela duquel le livreur est considere hors itineraire (precision GPS urbaine comprise). */
export const SEUIL_DEVIATION_M = 60;
/** Intervalle minimal entre deux recalculs pour un meme livreur (evite de saturer le service). */
export const DELAI_RECALCUL_MS = 12_000;
/** Vitesse de repli (scooter en ville) quand le service routier ne repond pas. */
const VITESSE_REPLI_KMH = 20;

let urlService = 'https://router.project-osrm.org/route/v1/driving';
/** Permet de pointer vers un serveur OSRM auto-heberge en production. */
export function configurerServiceItineraire(url: string) { urlService = url.replace(/\/$/, ''); }

export function distanceM(a: Coord, b: Coord): number {
  const r = Math.PI / 180, h = Math.sin((b[1] - a[1]) * r / 2) ** 2
    + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin((b[0] - a[0]) * r / 2) ** 2;
  return 12_742_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function cumulsDe(points: Coord[]): number[] {
  const c = [0];
  for (let i = 1; i < points.length; i++) c.push(c[i - 1] + distanceM(points[i - 1], points[i]) / 1000);
  return c;
}

function plusProcheIndex(points: Coord[], p: Coord, depuis = 0): number {
  let meilleur = depuis, d = Infinity;
  for (let i = depuis; i < points.length; i++) { const e = distanceM(points[i], p); if (e < d) { d = e; meilleur = i; } }
  return meilleur;
}

/** Projection d'un point sur le trace : segment, fraction, ecart en metres (approximation plane locale). */
export function projeter(it: Pick<ItineraireRoutier, 'points'>, p: Coord): { segment: number; t: number; ecartM: number; point: Coord } {
  const pts = it.points;
  if (pts.length < 2) return { segment: 0, t: 0, ecartM: pts.length ? distanceM(pts[0], p) : Infinity, point: pts[0] ?? p };
  const kx = Math.cos(p[1] * Math.PI / 180);
  let res = { segment: 0, t: 0, ecartM: Infinity, point: pts[0] };
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const dx = (b[0] - a[0]) * kx, dy = b[1] - a[1], px = (p[0] - a[0]) * kx, py = p[1] - a[1];
    const l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, (px * dx + py * dy) / l2)) : 0;
    const q: Coord = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], e = distanceM(q, p);
    if (e < res.ecartM) res = { segment: i, t, ecartM: e, point: q };
  }
  return res;
}

/** Ce qu'il reste a parcourir depuis la position (projetee sur le trace). */
export function progression(it: ItineraireRoutier, p: Coord) {
  const proj = projeter(it, p);
  const fait = it.cumuls[proj.segment] + (it.cumuls[proj.segment + 1] - it.cumuls[proj.segment]) * proj.t;
  const resteKm = Math.max(0, it.distanceKm - fait);
  const ratio = it.distanceKm ? resteKm / it.distanceKm : 0;
  const restant: Coord[] = [proj.point, ...it.points.slice(proj.segment + 1)];
  const prochaine = it.etapes.find(e => plusProcheIndex(it.points, e.point) > proj.segment);
  return { ...proj, resteKm, resteMin: Math.max(1, Math.round(it.dureeMin * ratio)), restant, prochaine,
    horsItineraire: proj.ecartM > SEUIL_DEVIATION_M };
}

/** Les arrets restants ont-ils change (statut passe de collecte a livraison, autre commande) ? */
export function memesArrets(it: ItineraireRoutier | undefined, arrets: Coord[]): boolean {
  return !!it && it.arrets.length === arrets.length && it.arrets.every((a, i) => distanceM(a, arrets[i]) < 15);
}

/** Faut-il recalculer ? Nouvel objectif, ou livreur sorti du trace (au plus une fois par DELAI_RECALCUL_MS). */
export function doitRecalculer(it: ItineraireRoutier | undefined, position: Coord, arrets: Coord[], maintenant = Date.now()): boolean {
  if (!it || !memesArrets(it, arrets)) return true;
  if (maintenant - it.calculeLe < DELAI_RECALCUL_MS) return false;
  return projeter(it, position).ecartM > SEUIL_DEVIATION_M || (it.source === 'direct' && maintenant - it.calculeLe > 60_000);
}

function itineraireDirect(depart: Coord, arrets: Coord[]): ItineraireRoutier {
  const points = [depart, ...arrets], cumuls = cumulsDe(points), km = cumuls[cumuls.length - 1];
  return { points, cumuls, arrets, indexArrets: arrets.map((_, i) => i + 1), distanceKm: km, dureeMin: Math.max(1, Math.round(km / VITESSE_REPLI_KMH * 60)),
    etapes: [], source: 'direct', calculeLe: Date.now() };
}

const DIRECTIONS: Record<string, string> = {
  left: 'à gauche', right: 'à droite', 'slight left': 'légèrement à gauche', 'slight right': 'légèrement à droite',
  'sharp left': 'franchement à gauche', 'sharp right': 'franchement à droite', straight: 'tout droit', uturn: 'demi-tour',
};
interface EtapeOsrm { distance: number; name: string; maneuver: { type: string; modifier?: string; location: Coord; exit?: number } }

/** Consigne en francais a partir d'une manoeuvre OSRM. */
export function instructionFr(e: EtapeOsrm): string {
  const { type, modifier, exit } = e.maneuver, dir = modifier ? DIRECTIONS[modifier] ?? '' : '';
  const rue = e.name ? ` sur ${e.name}` : '';
  switch (type) {
    case 'depart': return `Partez${rue}`;
    case 'arrive': return 'Vous êtes arrivé';
    case 'roundabout': case 'rotary': return `Au rond-point, prenez la ${exit ?? 1}${exit === 1 ? 're' : 'e'} sortie${rue}`;
    case 'turn': case 'end of road': case 'fork':
      if (modifier === 'uturn') return `Faites demi-tour${rue}`;
      return !modifier || modifier === 'straight' ? `Continuez tout droit${rue}` : `Tournez ${dir}${rue}`;
    case 'merge': case 'on ramp': case 'off ramp': return `Rejoignez la voie ${dir}${rue}`.trim();
    default: return modifier && modifier !== 'straight' ? `Continuez ${dir}${rue}` : `Continuez tout droit${rue}`;
  }
}

/**
 * Itineraire routier depart -> arrets (dans l'ordre). Ne rejette jamais : en cas d'echec,
 * renvoie un trace direct (source 'direct') pour que la carte reste utilisable.
 */
export async function calculerItineraire(depart: Coord, arrets: Coord[], signal?: AbortSignal): Promise<ItineraireRoutier> {
  if (!arrets.length) return itineraireDirect(depart, arrets);
  const chemin = [depart, ...arrets].map(p => `${p[0].toFixed(6)},${p[1].toFixed(6)}`).join(';');
  try {
    const reponse = await fetch(`${urlService}/${chemin}?overview=full&geometries=geojson&steps=true`, { signal });
    if (!reponse.ok) throw new Error(String(reponse.status));
    const json = await reponse.json() as { code: string; routes?: { distance: number; duration: number; geometry: { coordinates: Coord[] }; legs: { steps: EtapeOsrm[] }[] }[] };
    const route = json.routes?.[0];
    if (json.code !== 'Ok' || !route || route.geometry.coordinates.length < 2) throw new Error(json.code);
    const points = route.geometry.coordinates, cumuls = cumulsDe(points);
    let depuis = 0;
    const indexArrets = arrets.map(a => (depuis = plusProcheIndex(points, a, depuis)));
    const etapes = route.legs.flatMap(l => l.steps).filter(s => s.maneuver.type !== 'depart' || s === route.legs[0].steps[0])
      .map(s => ({ instruction: instructionFr(s), distanceM: Math.round(s.distance), point: s.maneuver.location }));
    return { points, cumuls, arrets, indexArrets, distanceKm: route.distance / 1000, dureeMin: Math.max(1, Math.round(route.duration / 60)),
      etapes, source: 'osrm', calculeLe: Date.now() };
  } catch (e) {
    if (signal?.aborted) throw e;
    return itineraireDirect(depart, arrets);
  }
}

/** Points regulierement espaces (pasMetres) le long d'un trace : simulation d'un trajet qui suit les rues. */
export function echantillonner(points: Coord[], pasMetres = 50): Coord[] {
  const cumuls = cumulsDe(points), total = cumuls[cumuls.length - 1] * 1000;
  const n = Math.max(1, Math.ceil(total / pasMetres));
  return Array.from({ length: n }, (_, i) => pointA(points, cumuls, ((i + 1) / n) * total / 1000));
}

/** Point situe a km du debut du trace. */
export function pointA(points: Coord[], cumuls: number[], km: number): Coord {
  for (let i = 1; i < points.length; i++) {
    if (km <= cumuls[i]) {
      const l = cumuls[i] - cumuls[i - 1], t = l ? (km - cumuls[i - 1]) / l : 0;
      return [points[i - 1][0] + (points[i][0] - points[i - 1][0]) * t, points[i - 1][1] + (points[i][1] - points[i - 1][1]) * t];
    }
  }
  return points[points.length - 1];
}
