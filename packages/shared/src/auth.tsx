import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, api, setToken, setUnauthorizedHandler } from './api';
import type { Profil, Role } from './types';

const CLE_TOKEN = 'fleetpulse.token';

interface AuthState {
  profil: Profil | null;
  chargement: boolean;
  /** Session enregistree mais serveur injoignable au demarrage : l'app affiche un ecran "Reessayer". */
  serveurInjoignable: string | null;
  reessayer: () => void;
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
  const [serveurInjoignable, setServeurInjoignable] = useState<string | null>(null);

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

  const restaurerSession = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync(CLE_TOKEN);
      if (token) await ouvrirSession(token);
      setServeurInjoignable(null);
    } catch (error) {
      if (error instanceof ApiError && error.status === 0) {
        // On garde le jeton : la session reprendra des que le serveur repond.
        setServeurInjoignable(error.message);
      } else {
        setServeurInjoignable(null);
        await logout();
      }
    } finally {
      setChargement(false);
    }
  }, [logout, ouvrirSession]);

  useEffect(() => {
    setUnauthorizedHandler(() => { void logout(); });
    void restaurerSession();
    return () => setUnauthorizedHandler(null);
  }, [logout, restaurerSession]);

  const reessayer = useCallback(() => {
    setChargement(true);
    void restaurerSession();
  }, [restaurerSession]);

  const oublierSession = useCallback(async () => {
    setServeurInjoignable(null);
    await logout();
  }, [logout]);

  const login = useCallback(async (email: string, motDePasse: string) => {
    const { token } = await api.login(email.trim().toLowerCase(), motDePasse);
    await ouvrirSession(token);
    await SecureStore.setItemAsync(CLE_TOKEN, token);
  }, [ouvrirSession]);

  const rafraichir = useCallback(async () => {
    setProfil(await api.me());
  }, []);

  const value = useMemo(
    () => ({ profil, chargement, serveurInjoignable, reessayer, login, logout: oublierSession, rafraichir }),
    [profil, chargement, serveurInjoignable, reessayer, login, oublierSession, rafraichir]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth doit etre utilise dans <AuthProvider>');
  return context;
}
