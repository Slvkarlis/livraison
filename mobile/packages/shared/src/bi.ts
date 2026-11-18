export interface PeriodeBi { debut: string; fin: string; depuis: string; jusqua: string }
export interface FinanceBi {
  periode: PeriodeBi; gmv: number; ventesArticles: number; commissionsNettes: number; margeLivraison: number;
  cashEnCirculation: number; reversementsAEffectuer: number; remunerationsAEffectuer: number;
  reversementsEffectues: number; remunerationsEffectuees: number; articlesVendus: number;
}
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
