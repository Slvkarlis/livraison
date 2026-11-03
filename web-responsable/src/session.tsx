import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError, http } from './api';
import type { Profil } from './types';
interface Session {
  profil: Profil | null; chargement: boolean;
  connexion: (identifiant: string, motDePasse: string) => Promise<void>; deconnexion: () => void;
}
const SessionContext = createContext<Session | null>(null);
// Les jetons web restent en mémoire, pour la durée de cet onglet.
export function SessionProvider({ children }: { children: ReactNode }) {
  const [profil, setProfil] = useState<Profil | null>(null);
  const [notification, setNotification] = useState('');
  const deconnexion = useCallback(() => {
    setProfil(null);
    void api.logout().catch(() => setNotification('Session locale fermée. Révocation serveur impossible : vérifiez le réseau.'));
  }, []);
  useEffect(() => {
    try { localStorage.removeItem('fleetpulse.responsable.token'); } catch { /* ancien stockage indisponible */ }
    http.onExpire(() => { setProfil(null); setNotification('Session expirée ou compte désactivé. Reconnectez-vous.'); });
    return () => http.onExpire(() => {});
  }, []);
  const connexion = useCallback(async (identifiant: string, motDePasse: string) => {
    await http.setJetons(await api.login(identifiant.trim(), motDePasse));
    try {
      const p = await api.me();
      if (p.role !== 'RESPONSABLE' || p.statut !== 'ACTIF')
        throw new ApiError(403, "Accès refusé : cet espace est réservé aux responsables actifs. Utilisez votre application mobile.");
      setProfil(p); setNotification('');
    } catch (e) { await api.logout().catch(() => {}); throw e; }
  }, []);
  return <SessionContext.Provider value={{ profil, chargement: false, connexion, deconnexion }}>
    {notification && <div className="bandeau" role="status">{notification}</div>}{children}
  </SessionContext.Provider>;
}
export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession hors de SessionProvider');
  return session;
}
