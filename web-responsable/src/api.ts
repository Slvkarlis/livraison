import type {
  AffectationRequest, AffectationZone, Livraison, Livreur, LivreurRequest, LoginResponse, Profil, Vehicule, VehiculeRequest,
} from './types';

import { creerClientHttp } from '../../mobile/packages/shared/src/http';
import { creerApiMarche } from '../../mobile/packages/shared/src/sprint2';
export { ApiError } from '../../mobile/packages/shared/src/http';
import type { Compte } from './sprint1';
export const http = creerClientHttp(() => '', () => 'Serveur injoignable. Vérifiez le backend sur le port 8083.');
const request = http.request;

export const api = {
  ...creerApiMarche(request),
  comptes: () => request<Compte[]>('GET', '/api/admin/comptes'),
  decision: (id: number, action: string, motif: string) => request<Compte>('PUT', '/api/admin/dossiers/' + id + '/' + action, { motif }),
  statutCompte: (id: number, action: string, motif: string) => request<Compte>('PUT', '/api/admin/comptes/' + id + '/' + action, { motif }),
  audit: (query: string) => request<PageAudit>('GET', '/api/admin/audit/page?' + query),

  demo: () => request<{ demonstration: boolean; delaiRenvoiSecondes: number }>('GET', '/api/auth/config'),
  logout: () => http.logout(),
  demanderOtp: (telephone: string) => request<void>('POST', '/api/auth/otp/demande', { telephone }),
  inscrireOtp: (data: unknown) => request<LoginResponse>('POST', '/api/auth/otp/inscription', data),
  oubli: (identifiant: string) => request<void>('POST', '/api/auth/mot-de-passe/oubli', { identifiant }),
  reinitialiser: (identifiant: string, code: string, nouveauMotDePasse: string) =>
    request<void>('POST', '/api/auth/mot-de-passe/reinitialiser', { identifiant, code, nouveauMotDePasse }),
  candidater: (partenaire: boolean, data: unknown) => request<Compte>('POST',
    '/api/auth/inscription/' + (partenaire ? 'partenaire' : 'livreur'), data),
  dossier: () => request<Compte>('GET', '/api/dossier'),
  corrigerDossier: (data: unknown) => request<Compte>('PUT', '/api/dossier', data),

  // US-01
  login: (email: string, motDePasse: string) =>
    request<LoginResponse>('POST', '/api/auth/login', { email, motDePasse },
      { 401: 'Email, téléphone ou mot de passe incorrect.' }),
  me: () => request<Profil>('GET', '/api/me'),

  // US-02
  livreurs: () => request<Livreur[]>('GET', '/api/admin/livreurs'),
  creerLivreur: (data: LivreurRequest) =>
    request<Livreur>('POST', '/api/admin/livreurs', data, {
      400: 'Nom, prénom, email et mot de passe (8 caractères min.) sont obligatoires.',
      409: 'Un compte existe déjà avec cet email.',
    }),
  modifierLivreur: (id: number, data: LivreurRequest) =>
    request<Livreur>('PUT', `/api/admin/livreurs/${id}`, data),
  desactiverLivreur: (id: number) => request<void>('DELETE', `/api/admin/livreurs/${id}`),
  activerLivreur: (id: number) => request<void>('PUT', `/api/admin/livreurs/${id}/activer`),

  // US-03
  vehicules: () => request<Vehicule[]>('GET', '/api/admin/vehicules'),
  creerVehicule: (data: VehiculeRequest) =>
    request<Vehicule>('POST', '/api/admin/vehicules', data, {
      400: 'Immatriculation obligatoire, consommation entre 2 et 30 L/100 km.',
      409: 'Un véhicule existe déjà avec cette immatriculation.',
    }),
  modifierVehicule: (id: number, data: VehiculeRequest) =>
    request<Vehicule>('PUT', `/api/admin/vehicules/${id}`, data, {
      400: 'La consommation doit être comprise entre 2 et 30 L/100 km.',
    }),
  desactiverVehicule: (id: number) => request<void>('DELETE', `/api/admin/vehicules/${id}`),
  activerVehicule: (id: number) => request<void>('PUT', `/api/admin/vehicules/${id}/activer`),
  affecterVehicule: (livreurId: number, vehiculeId: number) =>
    request<Livreur>('PUT', `/api/admin/livreurs/${livreurId}/vehicule`, { vehiculeId },
      { 404: 'Véhicule inactif ou introuvable.' }),
  retirerVehicule: (livreurId: number) => request<void>('DELETE', `/api/admin/livreurs/${livreurId}/vehicule`),

  // US-2B11 : zones de travail d'un livreur
  zonesLivreur: (livreurId: number) => request<AffectationZone[]>('GET', `/api/admin/livreurs/${livreurId}/zones`),
  affecterZone: (livreurId: number, data: AffectationRequest) =>
    request<AffectationZone>('POST', `/api/admin/livreurs/${livreurId}/zones`, data),
  retirerAffectation: (livreurId: number, affectationId: number) =>
    request<void>('DELETE', `/api/admin/livreurs/${livreurId}/zones/${affectationId}`),

  // US-07
  livraisons: () => request<Livraison[]>('GET', '/api/livraisons'),
};

export interface Audit { id: number; date: string; acteur: string; action: string; cibleType: string; cibleId: number | null; details: string | null }
export interface PageAudit { content: Audit[]; number: number; totalPages: number; totalElements: number }
