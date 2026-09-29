import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError, setToken, setUnauthorizedHandler } from './api';
import type { Profil } from './types';

const CLE = 'fleetpulse.responsable.token';

interface Session {
  profil: Profil | null;
  chargement: boolean;
  connexion: (email: string, motDePasse: string) => Promise<void>;
  deconnexion: () => void;
}

const SessionContext = createContext<Session | null>(null);

function lireToken() {
  try { return localStorage.getItem(CLE); } catch { return null; }
}

function ecrireToken(valeur: string | null) {
  try {
    if (valeur) localStorage.setItem(CLE, valeur); else localStorage.removeItem(CLE);
  } catch { /* stockage indisponible : la session dure le temps de l'onglet */ }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [profil, setProfil] = useState<Profil | null>(null);
  const [chargement, setChargement] = useState(true);

  const deconnexion = useCallback(() => {
    setToken(null);
    ecrireToken(null);
    setProfil(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(deconnexion);
    const token = lireToken();
    if (!token) { setChargement(false); return; }
    setToken(token);
    api.me()
      .then((p) => (p.role === 'RESPONSABLE' ? setProfil(p) : deconnexion()))
      .catch(() => deconnexion())
      .finally(() => setChargement(false));
  }, [deconnexion]);

  const connexion = useCallback(async (email: string, motDePasse: string) => {
    const { token } = await api.login(email.trim(), motDePasse);
    setToken(token);
    try {
      const p = await api.me();
      // US-01 : l'espace web est reserve au responsable
      if (p.role !== 'RESPONSABLE') {
        throw new ApiError(403, "Cet espace est réservé aux responsables. Utilisez l'application mobile.");
      }
      ecrireToken(token);
      setProfil(p);
    } catch (erreur) {
      setToken(null);
      throw erreur;
    }
  }, []);

  return (
    <SessionContext.Provider value={{ profil, chargement, connexion, deconnexion }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession hors de SessionProvider');
  return session;
}
