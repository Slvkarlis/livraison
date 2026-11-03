import type { Jetons } from './sprint1';

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message); this.status = status; this.code = code;
  }
}
type Messages = Partial<Record<number, string>>;
/** Une instance par application. Les jetons d'accès restent en mémoire. */
export function creerClientHttp(base: () => string, indisponible: () => string) {
  let jetons: Jetons | null = null;
  let version = 0;
  let refresh: Promise<void> | null = null;
  let sauvegarder: (v: Jetons | null) => Promise<void> = async () => {};
  let expire: () => void = () => {};
  let ecriture: Promise<void> = Promise.resolve();
  function persister(v: Jetons | null) {
    const enregistrer = sauvegarder;
    ecriture = ecriture.catch(() => {}).then(() => enregistrer(v));
    return ecriture;
  }
  async function brut(method: string, path: string, body?: unknown, token?: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      return await fetch(base() + path, { method, signal: controller.signal,
        headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined });
    } catch { throw new ApiError(0, indisponible()); }
    finally { clearTimeout(timer); }
  }
  async function lire<T>(r: Response, messages: Messages = {}): Promise<T> {
    const texte = await r.text();
    let data;
    try { data = texte ? JSON.parse(texte) : undefined; } catch { data = undefined; }
    if (!r.ok) throw new ApiError(r.status,
      data?.message ?? messages[r.status] ?? ({ 401: 'Session expirée, reconnectez-vous.',
        403: "Vous n'avez pas accès à cette action.", 429: 'Trop de demandes. Patientez avant de réessayer.' }[r.status])
      ?? (r.status >= 500 ? indisponible() : `Requête refusée (${r.status}).`), data?.code);
    return data as T;
  }
  async function revoquer(refreshToken: string) {
    await lire(await brut('POST', '/api/auth/logout', { refreshToken }));
  }
  async function renouveler() {
    if (refresh) return refresh;
    const avant = version;
    const ancien = jetons;
    if (!ancien) throw new ApiError(401, 'Reconnectez-vous.');
    refresh = (async () => {
      try {
        const nouveaux = await lire<Jetons>(await brut('POST', '/api/auth/refresh', { refreshToken: ancien.refreshToken }));
        if (avant !== version) { await revoquer(nouveaux.refreshToken); throw new ApiError(401, 'Session fermée.'); }
        jetons = nouveaux;
        await persister(nouveaux);
      } catch (e) {
        if (avant === version) { jetons = null; version++; try { await persister(null); } finally { expire(); } }
        throw e;
      } finally { refresh = null; }
    })();
    return refresh;
  }
  return {
    async setJetons(v: Jetons | null) { version++; jetons = v; await persister(v); },
    getJetons: () => jetons,
    onSauvegarde: (fn: (v: Jetons | null) => Promise<void>) => { sauvegarder = fn; },
    onExpire: (fn: () => void) => { expire = fn; },
    async logout() {
      // L'échec réseau est signalé ; l'application ferme néanmoins sa session locale.
      const ancien = jetons;
      version++; jetons = null;
      try { await persister(null); } finally { if (ancien) await revoquer(ancien.refreshToken); }
    },
    async request<T>(method: string, path: string, body?: unknown, messages: Messages = {}): Promise<T> {
      const publicRoute = path.startsWith('/api/auth/');
      const avant = version;
      const envoye = publicRoute ? undefined : jetons?.token;
      let r = await brut(method, path, body, envoye);
      if (r.status === 401 && envoye && avant === version) {
        // Une réponse tardive peut concerner l'ancien JWT, déjà renouvelé par une autre requête.
        if (jetons?.token === envoye) await renouveler();
        if (!jetons || avant !== version) throw new ApiError(401, 'Reconnectez-vous.');
        r = await brut(method, path, body, jetons.token);
        if (r.status === 401) { version++; jetons = null; try { await persister(null); } finally { expire(); } }
      }
      if (!publicRoute && avant !== version) throw new ApiError(401, 'Session fermée. Reconnectez-vous.');
      return lire<T>(r, messages);
    },
  };
}
