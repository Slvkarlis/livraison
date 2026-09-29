import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, api, setToken, setUnauthorizedHandler } from './api';
import type { Profil, Role } from './types';

const CLE_TOKEN = 'fleetpulse.token';

interface AuthState {
  profil: Profil | null;
  chargement: boolean;
  login: (email: string, motDePasse: string) => Promise<void>;
  logout: () => Promise<void>;
  rafraichir: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const LIBELLE_ROLE: Record<Role, string> = {
  CLIENT: 'client',
  LIVREUR: 'livreur',
  RESPONSABLE: 'responsable',
};

/** Session JWT persistante, limitee au role de l'application (client ou livreur). */
export function AuthProvider({ role, children }: { role: Role; children: ReactNode }) {
  const [profil, setProfil] = useState<Profil | null>(null);
  const [chargement, setChargement] = useState(true);

  const logout = useCallback(async () => {
    setToken(null);
    setProfil(null);
    await SecureStore.deleteItemAsync(CLE_TOKEN);
  }, []);

  const ouvrirSession = useCallback(async (token: string) => {
    setToken(token);
    const moi = await api.me();
    if (moi.role !== role) {
      setToken(null);
      throw new ApiError(403, `Ce compte n'est pas un compte ${LIBELLE_ROLE[role]}.`);
    }
    setProfil(moi);
  }, [role]);

  useEffect(() => {
    setUnauthorizedHandler(() => { void logout(); });
    (async () => {
      try {
        const token = await SecureStore.getItemAsync(CLE_TOKEN);
        if (token) await ouvrirSession(token);
      } catch (error) {
        // Serveur injoignable : on garde le jeton pour reessayer au prochain lancement.
        if (!(error instanceof ApiError && error.status === 0)) await logout();
      } finally {
        setChargement(false);
      }
    })();
    return () => setUnauthorizedHandler(null);
  }, [logout, ouvrirSession]);

  const login = useCallback(async (email: string, motDePasse: string) => {
    const { token } = await api.login(email.trim().toLowerCase(), motDePasse);
    await ouvrirSession(token);
    await SecureStore.setItemAsync(CLE_TOKEN, token);
  }, [ouvrirSession]);

  const rafraichir = useCallback(async () => {
    setProfil(await api.me());
  }, []);

  const value = useMemo(() => ({ profil, chargement, login, logout, rafraichir }),
    [profil, chargement, login, logout, rafraichir]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth doit etre utilise dans <AuthProvider>');
  return context;
}
