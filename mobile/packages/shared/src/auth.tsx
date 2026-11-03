import * as SecureStore from 'expo-secure-store';
import { Platform, Text } from 'react-native';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { ApiError, api, http } from './api';
import type { Profil, Role } from './types';
import type { Jetons } from './sprint1';
const CLE = 'fleetpulse.session.v2';
interface AuthState {
  profil: Profil | null; chargement: boolean; serveurInjoignable: string | null;
  reessayer: () => void; login: (identifiant: string, motDePasse: string) => Promise<void>;
  ouvrir: (jetons: Jetons) => Promise<void>; logout: () => Promise<void>; rafraichir: () => Promise<void>;
}
const AuthContext = createContext<AuthState | null>(null);
export function AuthProvider({ role, children }: { role: Role; children: ReactNode }) {
  const [profil, setProfil] = useState<Profil | null>(null);
  const [chargement, setChargement] = useState(true);
  const [serveurInjoignable, setServeurInjoignable] = useState<string | null>(null);
  const [notification, setNotification] = useState('');
  const ouvrir = useCallback(async (jetons: Jetons) => {
    await http.setJetons(jetons);
    try {
      const moi = await api.me();
      if (moi.role !== role && !(role === 'CLIENT' && moi.role === 'PARTENAIRE'))
        throw new ApiError(403, 'Accès refusé : utilisez l’application correspondant à votre rôle.');
      setProfil(moi); setNotification('');
    } catch (e) { await api.logout().catch(() => {}); throw e; }
  }, [role]);
  const logout = useCallback(async () => {
    setProfil(null); setServeurInjoignable(null);
    try { await api.logout(); }
    catch { setNotification('Session locale fermée. Révocation serveur impossible : vérifiez le réseau.'); }
  }, []);
  const chargerProfil = useCallback(async () => {
    if (Platform.OS === 'web') return null;
    const valeur = await SecureStore.getItemAsync(CLE);
    if (!valeur) return null;
    await http.setJetons(JSON.parse(valeur) as Jetons);
    const moi = await api.me();
    if (moi.role !== role && !(role === 'CLIENT' && moi.role === 'PARTENAIRE'))
      throw new ApiError(403, 'Ce compte ne correspond pas à cette application.');
    return moi;
  }, [role]);
  const appliquerProfil = useCallback((moi: Profil | null) => { setProfil(moi); setServeurInjoignable(null); }, []);
  const erreurRestauration = useCallback(async (e: unknown) => {
    if (e instanceof ApiError && e.status === 0 && http.getJetons()) setServeurInjoignable(e.message);
    else await logout();
  }, [logout]);
  const finirRestauration = useCallback(() => setChargement(false), []);
  useEffect(() => {
    http.onSauvegarde(async v => {
      if (Platform.OS !== 'web') {
        if (v) await SecureStore.setItemAsync(CLE, JSON.stringify(v));
        else await SecureStore.deleteItemAsync(CLE);
      }
    });
    http.onExpire(() => { setProfil(null); setNotification('Session expirée ou compte suspendu. Reconnectez-vous.'); });
    void chargerProfil().then(appliquerProfil).catch(erreurRestauration).finally(finirRestauration);
    return () => { http.onExpire(() => {}); http.onSauvegarde(async () => {}); };
  }, [chargerProfil, appliquerProfil, erreurRestauration, finirRestauration]);
  const login = useCallback(async (identifiant: string, motDePasse: string) => ouvrir(await api.login(identifiant.trim(), motDePasse)), [ouvrir]);
  const rafraichir = useCallback(async () => setProfil(await api.me()), []);
  return <AuthContext.Provider value={{ profil, chargement, serveurInjoignable,
    reessayer: () => { setChargement(true); void chargerProfil().then(appliquerProfil).catch(erreurRestauration).finally(finirRestauration); }, login, ouvrir, logout, rafraichir }}>
    {notification ? <Text accessibilityRole="alert" style={{ padding: 12, backgroundColor: '#FEF3C7', color: '#78350F' }}>{notification}</Text> : null}{children}
  </AuthContext.Provider>;
}
export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return context;
}
