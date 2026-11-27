import type { Livraison, Supervision } from './types';
import { pointA, type ItineraireRoutier } from '../../mobile/packages/shared/src/itineraireRoutier';

export type PointCarte = [number, number]; // longitude, latitude (GeoJSON)
export interface CoursierCarte {
  id: number; nom: string; position: PointCarte; date: string;
  historique?: PointCarte[];
  commande?: { id: number; code: string; zone: string; statut: Livraison['statut']; destination: PointCarte; commerce?: PointCarte; nomCommerce?: string };
}
export interface ArcCarte { id: number; points: PointCarte[]; couleur: number }
export interface ZoneCarte { id: number; nom: string; contour: PointCarte[] }
export interface ZonageCarte {
  zones: ZoneCarte[]; sommets: PointCarte[]; edition: boolean;
  selection?: number; onSelection?: (id: number) => void; onPoint: (point: PointCarte) => void;
  /** Edition fine : remplace toute la liste (deplacement, insertion, suppression d'un sommet). */
  onSommets?: (sommets: PointCarte[]) => void;
  /** Sommet selectionne (index), mis en avant et supprimable au clavier. */
  sommetChoisi?: number; onChoisir?: (index: number | undefined) => void;
}

/** Le contour ferme se croise-t-il lui-meme ? (segments non adjacents qui se coupent) */
export function contourSeCroise(points: PointCarte[]): boolean {
  const n = points.length; if (n < 4) return false;
  const orient = (a: PointCarte, b: PointCarte, c: PointCarte) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
  const coupe = (a: PointCarte, b: PointCarte, c: PointCarte, d: PointCarte) => orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (j === i + 1 || (i === 0 && j === n - 1)) continue;
    if (coupe(points[i], points[(i + 1) % n], points[j], points[(j + 1) % n])) return true;
  }
  return false;
}
export const CENTRE_TUNIS: PointCarte = [10.1795, 36.8065];
export const STATUTS_ACTIFS = ['AFFECTEE', 'RECUPEREE', 'EN_COURS', 'A_PROXIMITE', 'ARRIVEE'];
export function pointValide(longitude: unknown, latitude: unknown): boolean {
  return typeof longitude === 'number' && typeof latitude === 'number' && Number.isFinite(longitude) && Number.isFinite(latitude) && Math.abs(longitude) <= 180 && Math.abs(latitude) <= 90;
}
export function distanceKm(a: PointCarte, b: PointCarte): number {
  const r = Math.PI / 180, h = Math.sin((b[1] - a[1]) * r / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin((b[0] - a[0]) * r / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}
export function coursiersDepuisApi(supervision: Supervision, commandes: Livraison[]): CoursierCarte[] {
  return supervision.livreurs.filter(l => pointValide(l.longitude, l.latitude)).map(l => {
    // Le contrat ne livre qu'un prénom : aucune association en cas d'homonymie.
    const unique = supervision.livreurs.filter(c => c.prenom === l.prenom).length === 1;
    const commande = unique ? commandes.filter(c => c.livreurPrenom === l.prenom && STATUTS_ACTIFS.includes(c.statut) && pointValide(c.longitude, c.latitude)).sort((a, b) => a.id - b.id)[0] : undefined;
    return { id: l.id, nom: `${l.prenom} ${l.nom}`, position: [l.longitude!, l.latitude!], date: l.dernierePositionLe ?? '',
      commande: commande ? { id: commande.id, code: commande.codeSuivi, zone: commande.zoneNom ?? 'Zone non renseignée', statut: commande.statut, destination: [commande.longitude, commande.latitude],
        commerce: pointValide(commande.longitudeCommerce, commande.latitudeCommerce) ? [commande.longitudeCommerce!, commande.latitudeCommerce!] : undefined,
        nomCommerce: commande.nomPartenaire ?? undefined } : undefined };
  });
}

/**
 * Arrets restants dans l'ordre, comme un GPS : avant la collecte le livreur va au commerce puis au client ;
 * colis a bord, il va directement au client.
 */
export function arretsRestants(c: CoursierCarte): PointCarte[] {
  if (!c.commande) return [];
  return c.commande.statut === 'AFFECTEE' && c.commande.commerce ? [c.commande.commerce, c.commande.destination] : [c.commande.destination];
}

// Repli local sans écriture serveur : depart du livreur, commerce, client (Tunis centre).
// Les positions avancent le long de l'itineraire routier calcule (rues reelles), signale comme demonstration.
export const SCENARIO_DEMO: { nom: string; zone: string; commerce: string; depart: PointCarte; collecte: PointCarte; client: PointCarte; avance: number }[] = [
  { nom: 'Amine Ben Ali', zone: 'Centre-ville', commerce: 'Pizzeria Lafayette', depart: [10.1660, 36.7985], collecte: [10.1712, 36.8030], client: [10.1835, 36.8080], avance: .05 },
  { nom: 'Yasmine Trabelsi', zone: 'Lafayette', commerce: 'Boulangerie Bab Bhar', depart: [10.1880, 36.8150], collecte: [10.1815, 36.8090], client: [10.1760, 36.8040], avance: .35 },
  { nom: 'Aziz Mansour', zone: 'Habib Bourguiba', commerce: 'Café du Théâtre', depart: [10.1920, 36.7990], collecte: [10.1850, 36.8000], client: [10.1790, 36.7955], avance: .6 },
];
export function positionSurTrace(points: PointCarte[], progression: number): PointCarte {
  const longueurs = points.slice(1).map((p, i) => distanceKm(points[i], p));
  let reste = longueurs.reduce((a, b) => a + b, 0) * Math.max(0, Math.min(1, progression));
  for (let i = 0; i < longueurs.length; i++) {
    if (reste <= longueurs[i]) { const t = longueurs[i] ? reste / longueurs[i] : 0; return [points[i][0] + (points[i + 1][0] - points[i][0]) * t, points[i][1] + (points[i + 1][1] - points[i][1]) * t]; }
    reste -= longueurs[i];
  }
  return points[points.length - 1];
}
/** routes : itineraire complet depart -> commerce -> client de chaque livreur de demo (absent = ligne droite). */
export function coursiersDemo(secondes: number, routes: (ItineraireRoutier | undefined)[] = []): CoursierCarte[] {
  return SCENARIO_DEMO.map((d, i) => {
    const route = routes[i], progression = Math.min(.985, d.avance + secondes / 420);
    const total = route?.distanceKm ?? distanceKm(d.depart, d.collecte) + distanceKm(d.collecte, d.client);
    const fait = total * progression, aCollecte = route ? route.cumuls[route.indexArrets[0]] : distanceKm(d.depart, d.collecte);
    const position = route ? pointA(route.points, route.cumuls, fait) : positionSurTrace([d.depart, d.collecte, d.client], progression);
    const statut: Livraison['statut'] = fait < aCollecte ? 'AFFECTEE' : distanceKm(position, d.client) < .3 ? 'A_PROXIMITE' : 'RECUPEREE';
    return { id: -(i + 1), nom: d.nom, position, date: new Date().toISOString(),
      commande: { id: 701 + i, code: `DÉMO-${701 + i}`, zone: d.zone, statut, destination: d.client, commerce: d.collecte, nomCommerce: d.commerce } };
  });
}

export function arcEntre(a: PointCarte, b: PointCarte): PointCarte[] {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  return Array.from({ length: 33 }, (_, i) => { const t = i / 32, courbe = Math.sin(Math.PI * t) * .22; return [a[0] + dx * t - dy * courbe, a[1] + dy * t + dx * courbe]; });
}

// ---- Carte du responsable : commerces, clients et filtres ----

/** Point d'interet affiche sur la carte (commerce ou client), avec sa fiche au clic. */
export interface PoiCarte {
  id: string; type: 'commerce' | 'client'; position: PointCarte; titre: string; lignes: string[];
  /** Livreur concerne : un clic sur le point le selectionne. */
  livreurId?: number;
  /** Fait partie du trajet du livreur selectionne. */
  lie?: boolean;
  actif?: boolean;
}

export type EtapeFiltre = 'toutes' | 'attente' | 'collecte' | 'livraison';
/** Etape lisible d'une commande en cours, pour les filtres de la carte. */
export function etapeDe(statut: Livraison['statut']): Exclude<EtapeFiltre, 'toutes'> | null {
  if (['PENDING_PARTNER', 'ACCEPTEE', 'EN_PREPARATION', 'PRETE'].includes(statut)) return 'attente';
  if (statut === 'AFFECTEE') return 'collecte';
  if (['RECUPEREE', 'EN_COURS', 'A_PROXIMITE', 'ARRIVEE'].includes(statut)) return 'livraison';
  return null;
}
export const LIBELLES_ETAPE: Record<EtapeFiltre, string> = { toutes: 'Toutes', attente: 'Sans livreur', collecte: 'Vers le commerce', livraison: 'Vers le client' };

export interface FiltresCarte { livreurs: boolean; commerces: boolean; clients: boolean; etape: EtapeFiltre; recherche: string }
export const FILTRES_DEFAUT: FiltresCarte = { livreurs: true, commerces: true, clients: true, etape: 'toutes', recherche: '' };

export function correspond(texte: (string | null | undefined)[], recherche: string): boolean {
  const r = recherche.trim().toLowerCase();
  return !r || texte.some(t => t?.toLowerCase().includes(r));
}

/** Densite par zone (BI) : halo de chaleur + badge chiffre au centre de la zone. intensite entre 0 et 1. */
export interface BulleCarte { id: string; position: PointCarte; valeur: number; intensite: number; titre: string; lignes: string[] }
/** Zone circulaire en metres (groupes de quartier), avec sa fiche au clic. */
export interface CercleCarte { id: string; centre: PointCarte; rayonMetres: number; actif: boolean; titre: string; lignes: string[] }

/** Polygone (64 cotes) approchant un cercle de rayon donne en metres. */
export function polygoneCercle(centre: PointCarte, rayonMetres: number): PointCarte[] {
  const kx = 111_320 * Math.cos(centre[1] * Math.PI / 180), ky = 110_574;
  return Array.from({ length: 65 }, (_, i) => {
    const a = (i / 64) * 2 * Math.PI;
    return [centre[0] + Math.cos(a) * rayonMetres / kx, centre[1] + Math.sin(a) * rayonMetres / ky] as PointCarte;
  });
}
