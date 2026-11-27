import {
  SUIVI_GPS,
  api,
  calculerItineraire,
  echantillonner,
  enMission,
  useConfiguration,
  useEvenementsCommandes,
  type Mission,
  type Position,
} from '@fleetpulse/shared';
import * as Location from 'expo-location';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

/** Intervalle entre deux points simules : 50 m toutes les 2 s, soit 90 km/h au plus (sous le filtre du serveur). */
const PAS_SIMULATION_MS = 2000;

interface SuiviPosition {
  /** Au moins une mission en cours : la position est transmise. */
  actif: boolean;
  missions: Mission[];
  dernierEnvoi: Date | null;
  /** Derniere position connue du telephone (ou simulee) : sert au guidage routier. */
  position: Position | null;
  /** Dernier point ecarte par le serveur (imprecis, saut GPS) ; la position precedente reste valable. */
  ecarte: string | null;
  erreur: string | null;
  simulation: boolean;
  simuler: (depart: Position, arrivee: Position) => void;
  arreterSimulation: () => void;
}

const Contexte = createContext<SuiviPosition | null>(null);

/**
 * US-301 : transmet la position du coursier pendant ses missions, tant que l'application est ouverte.
 * Hors demonstration : GPS du telephone (watchPositionAsync). En demonstration : trajet simule a la demande,
 * car la position reelle (navigateur, bureau) est loin des zones de demo.
 */
export function SuiviPositionProvider({ children }: { children: ReactNode }) {
  const { demonstration } = useConfiguration();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [dernierEnvoi, setDernierEnvoi] = useState<Date | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [ecarte, setEcarte] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [simulation, setSimulation] = useState(false);
  const minuterie = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Invalide un calcul de trajet encore en cours quand la simulation est arretee ou relancee. */
  const jeton = useRef(0);
  const actif = enMission(missions.map((m) => m.statut));
  const actifRef = useRef(actif);
  useEffect(() => { actifRef.current = actif; }, [actif]);

  const recharger = useCallback(() => { void api.missions().then(setMissions).catch(() => {}); }, []);
  useEffect(recharger, [recharger]);
  useEvenementsCommandes(recharger);

  const envoyer = useCallback(async (position: Position, precision?: number | null) => {
    setPosition(position);
    try {
      const reponse = await api.envoyerPosition(position, precision);
      setErreur(null);
      if (reponse.acceptee) {
        setEcarte(null);
        if (reponse.date) setDernierEnvoi(new Date(reponse.date));
      } else {
        setEcarte(reponse.raison);
      }
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Position non transmise.');
    }
  }, []);

  // GPS reel, uniquement pendant les missions (compromis batterie, cahier des charges §4.3)
  useEffect(() => {
    if (!actif || demonstration) return;
    let abonnement: Location.LocationSubscription | null = null;
    let annule = false;
    void (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setErreur('Autorisez la localisation pour que le client puisse suivre la livraison.'); return; }
      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: SUIVI_GPS.intervalleMs, distanceInterval: SUIVI_GPS.distanceMetres },
        ({ coords }) => void envoyer({ latitude: coords.latitude, longitude: coords.longitude }, coords.accuracy),
        (raison) => setErreur('GPS indisponible : ' + raison),
      );
      if (annule) sub.remove(); else abonnement = sub;
    })().catch((e: unknown) => setErreur(e instanceof Error ? e.message : 'GPS indisponible.'));
    return () => { annule = true; abonnement?.remove(); };
  }, [actif, demonstration, envoyer]);

  const arreterSimulation = useCallback(() => {
    jeton.current += 1;
    if (minuterie.current) clearInterval(minuterie.current);
    minuterie.current = null;
    setSimulation(false);
  }, []);

  const simuler = useCallback((depart: Position, arrivee: Position) => {
    arreterSimulation();
    const courant = jeton.current;
    setSimulation(true);
    void envoyer(depart);
    // Le trajet simule suit les rues (comme un vrai livreur) : il ne declenche pas de faux recalculs d'itineraire.
    void calculerItineraire([depart.longitude, depart.latitude], [[arrivee.longitude, arrivee.latitude]]).then((route) => {
      if (courant !== jeton.current) return;
      const points: Position[] = echantillonner(route.points, 50).map(([longitude, latitude]) => ({ latitude, longitude }));
      let i = 0;
      minuterie.current = setInterval(() => {
        // Livraison terminee ou annulee pendant la simulation : plus rien a transmettre
        if (!actifRef.current) { arreterSimulation(); return; }
        void envoyer(points[i]);
        i += 1;
        if (i >= points.length) arreterSimulation();
      }, PAS_SIMULATION_MS);
    });
  }, [arreterSimulation, envoyer]);

  useEffect(() => arreterSimulation, [arreterSimulation]);

  return (
    <Contexte.Provider value={{ actif, missions, dernierEnvoi, position, ecarte, erreur, simulation, simuler, arreterSimulation }}>
      {children}
    </Contexte.Provider>
  );
}

export function useSuiviPosition(): SuiviPosition {
  const valeur = useContext(Contexte);
  if (!valeur) throw new Error('SuiviPositionProvider manquant.');
  return valeur;
}
