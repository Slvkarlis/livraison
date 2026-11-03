import { apiBaseUrl } from './config';
import type {
  CreateLivraisonRequest,
  Devis,
  DevisRequest,
  Livraison,
  LoginResponse,
  Paiement,
  PaiementConfig,
  Profil,
  SignupRequest,
} from './types';

import { creerClientHttp } from './http';
import type { Compte } from './sprint1';
export { ApiError } from './http';
export const http = creerClientHttp(apiBaseUrl, () => `Serveur injoignable (${apiBaseUrl()}). Vérifiez votre connexion et le backend.`);
const request = http.request;

export const api = {
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

  login: (email: string, motDePasse: string) =>
    request<LoginResponse>('POST', '/api/auth/login', { email, motDePasse }, {
      401: 'Email ou mot de passe incorrect.',
    }),

  signup: (data: SignupRequest) =>
    request<void>('POST', '/api/auth/signup', data, {
      400: 'Vérifiez les champs : nom, prénom, email et mot de passe (8 caractères minimum).',
      409: 'Un compte existe déjà avec cet email.',
    }),

  me: () => request<Profil>('GET', '/api/me'),

  mesLivraisons: () => request<Livraison[]>('GET', '/api/livraisons/mes'),

  devis: (data: DevisRequest) => request<Devis>('POST', '/api/livraisons/devis', data),

  creerLivraison: (data: CreateLivraisonRequest) => request<Livraison>('POST', '/api/livraisons', data),

  paiementConfig: () => request<PaiementConfig>('GET', '/api/paiements/config'),

  demarrerPaiement: (livraisonId: number) => request<Paiement>('POST', `/api/livraisons/${livraisonId}/paiement`),

  verifierPaiement: (livraisonId: number) =>
    request<Livraison>('POST', `/api/livraisons/${livraisonId}/paiement/verifier`),
};
