export interface PeriodeBi { debut: string; fin: string; depuis: string; jusqua: string }
export interface FinanceBi {
  periode: PeriodeBi; gmv: number; ventesArticles: number; commissionsNettes: number; margeLivraison: number;
  cashEnCirculation: number; reversementsAEffectuer: number; remunerationsAEffectuer: number;
  reversementsEffectues: number; remunerationsEffectuees: number; articlesVendus: number;
}
export interface ZoneBi { id: number; nom: string; latitude: number; longitude: number; commandes: number; livrees: number; commandesActives: number; coursiersDisponibles: number; couverturePourcent: number | null }
export interface OperationsBi {
  periode: PeriodeBi; observeLe: string; statuts: { statut: string; commandes: number }[]; zones: ZoneBi[];
  gainDistanceKm: number | null; gainTempsMinutes: number | null; indisponibiliteGains: string;
}
export interface PartenaireBi {
  id: number; nomCommerce: string; commandes: number; acceptees: number; refusees: number; tauxAcceptation: number | null; tauxRefus: number | null;
  preparationEstimeeMinutes: number | null; preparationReelleMinutes: number | null; preparationsMesurees: number;
  noteMoyenne: number | null; nombreNotes: number; classement: number | null; motifs: { motif: string; commandes: number }[];
  tauxExpiration: number | null; reclamations: number | null;
}
export interface PartenairesBi { periode: PeriodeBi; partenaires: PartenaireBi[] }
export interface CoursierBi {
  id: number; missions: number; minutesParKm: number | null; trajetsMesures: number; etaMesurables: number; etaRespectes: number;
  respectEtaPourcent: number | null; delaiDepotHeures: number | null; depotsMesures: number; missionsNonDeposees: number;
  ecartsDepot: number; noteMoyenne: number | null; nombreNotes: number;
}
export interface ProductiviteZoneBi { id: number | null; nom: string; livraisons: number; coursiers: number; distanceEstimeeKm: number; livraisonsParJour: number; missionsParCoursier: number | null }
export interface CoursiersBi { periode: PeriodeBi; coursiers: CoursierBi[]; zones: ProductiviteZoneBi[] }
export function jourTunis(date = new Date()): string {
  const parties = new Intl.DateTimeFormat('fr', { timeZone: 'Africa/Tunis', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const lire = (type: string) => parties.find(p => p.type === type)?.value ?? '';
  return `${lire('year')}-${lire('month')}-${lire('day')}`;
}
export function periodeParDefaut(): { debut: string; fin: string } {
  const fin = jourTunis(), d = new Date(fin + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 29);
  return { debut: d.toISOString().slice(0, 10), fin };
}
export function filtreBi(debut: string, fin: string, zoneId?: string): string {
  const q = new URLSearchParams({ debut, fin });
  if (zoneId) q.set('zoneId', zoneId);
  return q.toString();
}
export function valeurBi(valeur: number | null | undefined, unite = ''): string {
  return valeur == null ? 'Non disponible' : new Intl.NumberFormat('fr-TN', { maximumFractionDigits: 3 }).format(valeur) + unite;
}
