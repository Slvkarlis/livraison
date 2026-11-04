import { apiBaseUrl } from './config';
import type {
  Livraison,
  LoginResponse,
  Profil,
  SignupRequest,
} from './types';

import { ApiError, creerClientHttp } from './http';
import { creerApiMarche } from './sprint2';
import { creerApiPartenaire } from './sprint2bis';
import type { Compte } from './sprint1';
export { ApiError } from './http';
export const http = creerClientHttp(apiBaseUrl, () => `Serveur injoignable (${apiBaseUrl()}). Vérifiez votre connexion et le backend.`);
const request = http.request;

type ConfigurationAuth = { demonstration: boolean; delaiRenvoiSecondes: number };

function estConfigurationAuth(value: unknown): value is ConfigurationAuth {
  if (typeof value !== 'object' || value === null) return false;
  const config = value as Record<string, unknown>;
  return typeof config.demonstration === 'boolean'
    && typeof config.delaiRenvoiSecondes === 'number'
    && Number.isFinite(config.delaiRenvoiSecondes);
}

export const api = {
  ...creerApiMarche(request),
  ...creerApiPartenaire(request),
  demo: async () => {
    const config = await request<unknown>('GET', '/api/auth/config');
    if (!estConfigurationAuth(config)) {
      throw new ApiError(502, 'Configuration reçue du serveur invalide.');
    }
    return config;
  },
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
};
