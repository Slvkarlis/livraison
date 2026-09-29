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

/** Erreur API avec un message affichable tel quel a l'utilisateur. */
export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

type Messages = Partial<Record<number, string>>;

const MESSAGES_PAR_DEFAUT: Record<number, string> = {
  400: 'Certaines informations sont invalides.',
  401: 'Session expirée, reconnectez-vous.',
  403: "Vous n'avez pas accès à cette action.",
  404: 'Élément introuvable.',
  409: 'Cet élément existe déjà.',
};

/** Sans delai maximal, un pare-feu qui ignore la connexion laisse l'application charger indefiniment. */
const DELAI_MAX_MS = 10_000;

function messageServeurInjoignable() {
  return `Serveur injoignable (${apiBaseUrl()}). Vérifiez que le backend tourne, que le port 8083 est autorisé `
    + 'dans le pare-feu et que le téléphone est sur le même Wi-Fi.';
}

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setToken(value: string | null) {
  token = value;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

async function request<T>(method: string, path: string, body?: unknown, messages: Messages = {}): Promise<T> {
  let response: Response;
  const annulation = new AbortController();
  const minuteur = setTimeout(() => annulation.abort(), DELAI_MAX_MS);
  try {
    response = await fetch(apiBaseUrl() + path, {
      method,
      signal: annulation.signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, messageServeurInjoignable());
  } finally {
    clearTimeout(minuteur);
  }

  if (!response.ok) {
    if (response.status === 401 && token) onUnauthorized?.();
    // Les erreurs metier arrivent en JSON {code, message} ; sinon message deduit du code HTTP.
    const corps = await response.json().catch(() => null) as { message?: string } | null;
    const message = messages[response.status] ?? corps?.message ?? MESSAGES_PAR_DEFAUT[response.status]
      ?? `Erreur inattendue (${response.status}).`;
    throw new ApiError(response.status, message);
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
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
