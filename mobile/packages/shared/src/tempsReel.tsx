// Sprint 2 bis : changements de statut des commandes en temps reel (STOMP sur WebSocket, /ws du backend).
import { Client } from '@stomp/stompjs';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { api, http } from './api';
import { apiBaseUrl } from './config';
import { lireNotification, type NotificationCommande } from './notifications';
import { lirePositionCommande, type PositionCommande } from './suivi';
import type { StatutLivraison } from './types';

/** Miroir de EvenementCommande.java ; ancien null = nouvelle commande. */
export interface EvenementCommande { commandeId: number; ancien: StatutLivraison | null; nouveau: StatutLivraison }
type Ecouteur = (evenement: EvenementCommande) => void;
type EcouteurPosition = (position: PositionCommande) => void;
type EcouteurNotification = (notification: NotificationCommande) => void;

export const FILE_COMMANDES = '/user/queue/commandes';
/** US-302 : positions du coursier, recues par le client dont le colis est a bord. */
export const FILE_POSITIONS = '/user/queue/positions';
/** US-304 : notification a chaque changement de statut (bandeau dans l'application). */
export const FILE_NOTIFICATIONS = '/user/queue/notifications';
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

interface TempsReel {
  connecte: boolean;
  abonner: (fn: Ecouteur) => () => void;
  abonnerPositions: (fn: EcouteurPosition) => () => void;
  abonnerNotifications: (fn: EcouteurNotification) => () => void;
}
const TempsReelContext = createContext<TempsReel>({ connecte: false, abonner: () => () => {}, abonnerPositions: () => () => {}, abonnerNotifications: () => () => {} });

/** Une seule connexion par application, ouverte tant que actif (utilisateur connecte et compte actif). */
export function TempsReelProvider({ actif, children }: { actif: boolean; children: ReactNode }) {
  const ecouteurs = useRef(new Set<Ecouteur>());
  const ecouteursPositions = useRef(new Set<EcouteurPosition>());
  const ecouteursNotifications = useRef(new Set<EcouteurNotification>());
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
        client.subscribe(FILE_POSITIONS, (message) => {
          const position = lirePositionCommande(message.body);
          if (position) ecouteursPositions.current.forEach((fn) => fn(position));
        });
        client.subscribe(FILE_NOTIFICATIONS, (message) => {
          const notification = lireNotification(message.body);
          if (notification) ecouteursNotifications.current.forEach((fn) => fn(notification));
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

  const abonnerPositions = useCallback((fn: EcouteurPosition) => {
    ecouteursPositions.current.add(fn);
    return () => { ecouteursPositions.current.delete(fn); };
  }, []);

  const abonnerNotifications = useCallback((fn: EcouteurNotification) => {
    ecouteursNotifications.current.add(fn);
    return () => { ecouteursNotifications.current.delete(fn); };
  }, []);

  return <TempsReelContext.Provider value={{ connecte, abonner, abonnerPositions, abonnerNotifications }}>{children}</TempsReelContext.Provider>;
}

/** Appelle fn a chaque changement de statut d'une commande de l'utilisateur. */
export function useEvenementsCommandes(fn: Ecouteur) {
  const { abonner } = useContext(TempsReelContext);
  const courant = useRef(fn);
  useEffect(() => { courant.current = fn; });
  useEffect(() => abonner((e) => courant.current(e)), [abonner]);
}

/** US-302 : appelle fn a chaque position du coursier transportant un colis de l'utilisateur. */
export function usePositionsLivreur(fn: EcouteurPosition) {
  const { abonnerPositions } = useContext(TempsReelContext);
  const courant = useRef(fn);
  useEffect(() => { courant.current = fn; });
  useEffect(() => abonnerPositions((p) => courant.current(p)), [abonnerPositions]);
}

export function useTempsReelConnecte(): boolean {
  return useContext(TempsReelContext).connecte;
}

/** US-304 : appelle fn a chaque notification recue en temps reel (bandeau). */
export function useNotificationsTempsReel(fn: EcouteurNotification) {
  const { abonnerNotifications } = useContext(TempsReelContext);
  const courant = useRef(fn);
  useEffect(() => { courant.current = fn; });
  useEffect(() => abonnerNotifications((n) => courant.current(n)), [abonnerNotifications]);
}
