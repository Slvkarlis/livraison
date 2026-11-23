import type { Livraison, Supervision } from './types';

export type PointCarte = [number, number]; // longitude, latitude (GeoJSON)
export interface CoursierCarte {
  id: number; nom: string; position: PointCarte; date: string;
  commande?: { id: number; code: string; zone: string; statut: Livraison['statut']; destination: PointCarte };
}
export interface ArcCarte { id: number; points: PointCarte[]; couleur: number }
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
      commande: commande ? { id: commande.id, code: commande.codeSuivi, zone: commande.zoneNom ?? 'Zone non renseignée', statut: commande.statut, destination: [commande.longitude, commande.latitude] } : undefined };
  });
}

// Repli local sans écriture serveur. Coordonnées du scénario du simulateur existant ;
// tracés urbains schématiques, explicitement signalés comme démonstration.
const TRAJETS: PointCarte[][] = [
  [[10.168, 36.800], [10.171, 36.800], [10.171, 36.8032], [10.1772, 36.8032]],
  [[10.1815, 36.809], [10.1795, 36.809], [10.1795, 36.8065]],
  [[10.185, 36.8025], [10.1815, 36.8025], [10.1815, 36.8008]],
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
export function coursiersDemo(secondes: number): CoursierCarte[] {
  return TRAJETS.map((points, i) => ({ id: -(i + 1), nom: ['Amine Ben Ali', 'Yasmine Trabelsi', 'Aziz Mansour'][i],
    position: positionSurTrace(points, Math.min(.98, .15 + i * .18 + secondes / 480)), date: new Date().toISOString(),
    commande: { id: 701 + i, code: `DÉMO-${701 + i}`, zone: ['Centre-ville', 'Lafayette', 'Habib Bourguiba'][i], statut: i === 1 ? 'A_PROXIMITE' : 'RECUPEREE', destination: points[points.length - 1] } }));
}

export function arcEntre(a: PointCarte, b: PointCarte): PointCarte[] {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  return Array.from({ length: 33 }, (_, i) => { const t = i / 32, courbe = Math.sin(Math.PI * t) * .22; return [a[0] + dx * t - dy * courbe, a[1] + dy * t + dx * courbe]; });
}
