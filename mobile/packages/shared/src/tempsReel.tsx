// Sprint 2 bis : changements de statut des commandes en temps reel (STOMP sur WebSocket, /ws du backend).
import { Client } from '@stomp/stompjs';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { api, http } from './api';
import { apiBaseUrl } from './config';
import type { StatutLivraison } from './types';

/** Miroir de EvenementCommande.java ; ancien null = nouvelle commande. */
export interface EvenementCommande { commandeId: number; ancien: StatutLivraison | null; nouveau: StatutLivraison }
type Ecouteur = (evenement: EvenementCommande) => void;

export const FILE_COMMANDES = '/user/queue/commandes';
/** http://hote:8083 -> ws://hote:8083/ws (https -> wss). */
export function urlTempsReel(base: string): string {
  return base.replace(/^http/, 'ws').replace(/\/+$/, '') + '/ws';
}
export function lireEvenement(corps: string): EvenementCommande | null {
  try {
    const e = JSON.parse(corps) as Partial<EvenementCommande>;
    return typeof e.commandeId === 'number' && typeof e.nouveau === 'string' ? { commandeId: e.commandeId, ancien: e.ancien ?? null, nouveau: e.nouveau } : null;
  } catch {
    return null;
  }
}

interface TempsReel { connecte: boolean; abonner: (fn: Ecouteur) => () => void }
const TempsReelContext = createContext<TempsReel>({ connecte: false, abonner: () => () => {} });

/** Une seule connexion par application, ouverte tant que actif (utilisateur connecte et compte actif). */
export function TempsReelProvider({ actif, children }: { actif: boolean; children: ReactNode }) {
  const ecouteurs = useRef(new Set<Ecouteur>());
  const [connecte, setConnecte] = useState(false);

  useEffect(() => {
    if (!actif) return;
    const natif = Platform.OS !== 'web';
    const client = new Client({
      brokerURL: urlTempsReel(apiBaseUrl()),
      reconnectDelay: 3000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      // React Native : recommandation stompjs (trames binaires, NUL final parfois absent en reception)
      forceBinaryWSFrames: natif,
      appendMissingNULLonIncoming: natif,
      // Jeton relu a chaque (re)connexion : il a pu etre renouvele par l'API entre-temps
      beforeConnect: (c) => { c.connectHeaders = { Authorization: `Bearer ${http.getJetons()?.token ?? ''}` }; },
      onConnect: () => {
        setConnecte(true);
        client.subscribe(FILE_COMMANDES, (message) => {
          const evenement = lireEvenement(message.body);
          if (evenement) ecouteurs.current.forEach((fn) => fn(evenement));
        });
      },
      // Jeton refuse (souvent expire) : un appel API declenche le renouvellement, la reconnexion suivante l'utilise
      onStompError: () => { void api.me().catch(() => {}); },
      onWebSocketClose: () => setConnecte(false),
    });
    client.activate();
    return () => { setConnecte(false); void client.deactivate(); };
  }, [actif]);

  const abonner = useCallback((fn: Ecouteur) => {
    ecouteurs.current.add(fn);
    return () => { ecouteurs.current.delete(fn); };
  }, []);

  return <TempsReelContext.Provider value={{ connecte, abonner }}>{children}</TempsReelContext.Provider>;
}

/** Appelle fn a chaque changement de statut d'une commande de l'utilisateur. */
export function useEvenementsCommandes(fn: Ecouteur) {
  const { abonner } = useContext(TempsReelContext);
  const courant = useRef(fn);
  useEffect(() => { courant.current = fn; });
  useEffect(() => abonner((e) => courant.current(e)), [abonner]);
}

export function useTempsReelConnecte(): boolean {
  return useContext(TempsReelContext).connecte;
}
