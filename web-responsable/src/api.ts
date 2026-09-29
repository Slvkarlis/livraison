import type {
  Livraison, Livreur, LivreurRequest, LoginResponse, Profil, Vehicule, VehiculeRequest,
} from './types';

/** Erreur API avec un message affichable tel quel. */
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

const SERVEUR_INJOIGNABLE = 'Serveur injoignable. Vérifiez que le backend tourne sur le port 8083.';
const DELAI_MAX_MS = 10_000;

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
  try {
    response = await fetch(path, {
      method,
      signal: AbortSignal.timeout(DELAI_MAX_MS),
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, SERVEUR_INJOIGNABLE);
  }

  if (!response.ok) {
    if (response.status === 401 && token) onUnauthorized?.();
    const corps = await response.json().catch(() => null) as { message?: string } | null;
    // Le proxy Vite repond sans corps JSON quand le backend est arrete.
    if (response.status >= 500 && !corps) throw new ApiError(0, SERVEUR_INJOIGNABLE);
    const message = messages[response.status] ?? corps?.message ?? MESSAGES_PAR_DEFAUT[response.status]
      ?? `Erreur inattendue (${response.status}).`;
    throw new ApiError(response.status, message);
  }
  const texte = await response.text();
  return (texte ? JSON.parse(texte) : undefined) as T;
}

export const api = {
  // US-01
  login: (email: string, motDePasse: string) =>
    request<LoginResponse>('POST', '/api/auth/login', { email, motDePasse },
      { 401: 'Email ou mot de passe incorrect.' }),
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

  // US-07
  livraisons: () => request<Livraison[]>('GET', '/api/livraisons'),
};
