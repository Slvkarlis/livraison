// Sprint 5 (US-504, US-512) : caisse et remuneration du coursier, miroir de FinanceDto.java.

export interface CommandeEncaissee {
  commandeId: number; codeSuivi: string; nomCommerce: string | null; livreeLe: string; montantEncaisse: number; ecartEncaissement: number;
}
export interface RecuDepot {
  id: number; numeroRecu: string; montantAttendu: number; montantRecu: number; ecart: number; motifEcart: string | null;
  statut: 'RAPPROCHE' | 'ECART'; nbCommandes: number; date: string;
}
export interface ReleveLivreur { closingId: number; semaine: string; nbMissions: number; distanceKm: number; remuneration: number; valideLe: string }
export interface CaisseLivreur {
  solde: number; commandes: CommandeEncaissee[]; recus: RecuDepot[];
  missionsEnAttente: number; remunerationEnAttente: number; releves: ReleveLivreur[];
}

/** Anciennete du cash detenu, en heures entieres : au-dela d'une journee le coursier est invite a deposer. */
export function heuresDepuis(iso: string, maintenant: Date = new Date()): number {
  return Math.max(0, Math.floor((maintenant.getTime() - new Date(iso).getTime()) / 3_600_000));
}

export const DELAI_DEPOT_CONSEILLE_HEURES = 24;

/** Message affiche au coursier selon son solde et l'anciennete de son plus ancien encaissement. */
export function conseilDepot(c: Pick<CaisseLivreur, 'solde' | 'commandes'>, maintenant: Date = new Date()): string {
  if (c.solde <= 0 || c.commandes.length === 0) return 'Aucun cash à déposer.';
  const heures = heuresDepuis(c.commandes[0].livreeLe, maintenant);
  return heures >= DELAI_DEPOT_CONSEILLE_HEURES
    ? `Cash détenu depuis ${heures} h : déposez-le auprès du responsable.`
    : 'Déposez l’intégralité de ce montant auprès du responsable.';
}

/** « Semaine du 16/11 » à partir de la date ISO du lundi (sans dependance au fuseau). */
export function libelleSemaine(lundi: string): string {
  const [, mois, jour] = lundi.split('-');
  return `Semaine du ${jour}/${mois}`;
}

export function creerApiCaisseLivreur(request: <T>(method: string, path: string, body?: unknown) => Promise<T>) {
  return { caisse: () => request<CaisseLivreur>('GET', '/api/livreur/caisse') };
}
