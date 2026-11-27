// Sprint 4 (US-404, US-405) : offres de lots et itineraire du coursier, miroir de DispatchDto.java.

export type TypeEtape = 'COLLECTE' | 'LIVRAISON';

/** Arret ordonne ; latitude / longitude du client null tant que le colis n'est pas collecte. */
export interface EtapeLot {
  ordre: number; commandeId: number; codeSuivi: string; type: TypeEtape; libelle: string;
  latitude: number | null; longitude: number | null; minutesDepuisDepart: number | null;
}

/** horsZone : offre venue d'une zone voisine (debordement), signalee au coursier. */
export interface OffreLot {
  id: number; lotId: number; proposeeLe: string; expireLe: string; horsZone: boolean; distanceLivreurKm: number | null;
  nbCommandes: number; distanceKm: number; dureeMinutes: number; montantACollecter: number; etapes: EtapeLot[];
  source?: string;
}

export interface LotLivreur {
  id: number; statut: 'PROPOSE' | 'ACCEPTE' | 'ANNULE'; source: string | null; livreurPrenom: string | null;
  accepteLe: string | null; distanceKm: number; dureeMinutes: number; commandes: number[]; etapes: EtapeLot[];
}

/** Secondes avant l'expiration de l'offre, jamais negatif. */
export function secondesRestantes(expireLe: string, maintenant: Date = new Date()): number {
  return Math.max(0, Math.ceil((new Date(expireLe).getTime() - maintenant.getTime()) / 1000));
}

/** Offres encore acceptables (le serveur reste seul juge : une acceptation tardive recoit 409). */
export function offresActives(offres: OffreLot[], maintenant: Date = new Date()): OffreLot[] {
  return offres.filter((o) => secondesRestantes(o.expireLe, maintenant) > 0);
}

/** Resume d'une offre : « 2 collectes · 4,2 km · 25 min ». */
export function resumeOffre(o: Pick<OffreLot, 'nbCommandes' | 'distanceKm' | 'dureeMinutes'>): string {
  const collectes = `${o.nbCommandes} collecte${o.nbCommandes > 1 ? 's' : ''}`;
  return `${collectes} · ${o.distanceKm.toFixed(1).replace('.', ',')} km · ${o.dureeMinutes} min`;
}

/** Libelle court d'un arret : « 1. Collecte · Chez Amira — Tunis centre ». */
export function libelleEtape(e: Pick<EtapeLot, 'ordre' | 'type' | 'libelle'>): string {
  return `${e.ordre}. ${e.type === 'COLLECTE' ? 'Collecte' : 'Livraison'} · ${e.libelle}`;
}

/** Un lot merite un itineraire affiche quand il compte plusieurs commandes encore en cours. */
export function itineraireUtile(lots: LotLivreur[]): LotLivreur | null {
  return lots.find((l) => l.commandes.length > 1) ?? null;
}

export function creerApiDispatchLivreur(request: <T>(method: string, path: string, body?: unknown) => Promise<T>) {
  return {
    offres: () => request<OffreLot[]>('GET', '/api/livreur/offres'),
    accepterOffre: (id: number) => request<LotLivreur>('PUT', '/api/livreur/offres/' + id + '/accepter'),
    refuserOffre: (id: number, motif: string | null) => request<void>('PUT', '/api/livreur/offres/' + id + '/refuser', { motif }),
    lotsEnCours: () => request<LotLivreur[]>('GET', '/api/livreur/lots'),
  };
}
