import { http } from './api';
export interface GroupeQuartierAdmin {
  id: number; commerceId: number; commerce: string; statut: 'OUVERT' | 'COMPLET' | 'FERME' | 'ANNULE'; nbMembres: number;
  latitude: number; longitude: number; rayonMetres: number; ouverture: string; expiration: string; lotId: number | null; gainKm: number; gainDt: number;
}
export interface StatsQuartier { ouverts: number; fermes: number; annules: number; tauxRemplissage: number; kmEconomises: number; dtEconomises: number }
export interface CommerceQuartier { id: number; nomCommerce: string; groupesQuartierActifs: boolean }
export interface ReglagesQuartier { rayonMetres: number; fenetreSecondes: number; preparationMinutes: number; promesseMinutes: number; reductionDeux: number; reductionTrois: number; coutKm: number }
export interface IndicateursQuartier { mode: string; commandes: number; tournees: number; kmTotaux: number; coutParCommande: number; commandesParCoursierHeure: number; aHeurePct: number; fraisMoyenClient: number }
export interface ComparaisonQuartier { tauxAdhesion: number; scenarios: IndicateursQuartier[] }
export const quartierApi = {
  groupes: () => http.request<GroupeQuartierAdmin[]>('GET', '/api/admin/quartier/groupes'),
  statistiques: () => http.request<StatsQuartier>('GET', '/api/admin/quartier/statistiques'),
  commerces: () => http.request<CommerceQuartier[]>('GET', '/api/admin/quartier/commerces'),
  activer: (id: number, groupesQuartierActifs: boolean) => http.request<CommerceQuartier>('PUT', '/api/admin/quartier/commerces/' + id, { groupesQuartierActifs }),
  parametres: () => http.request<ReglagesQuartier>('GET', '/api/admin/quartier/parametres'),
  modifier: (r: ReglagesQuartier) => http.request<ReglagesQuartier>('PUT', '/api/admin/quartier/parametres', r),
  simuler: (s: unknown) => http.request<ComparaisonQuartier>('POST', '/api/admin/simulateur/quartier', s),
};
