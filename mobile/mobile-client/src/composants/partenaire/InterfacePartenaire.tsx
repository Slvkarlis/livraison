import Ionicons from '@expo/vector-icons/Ionicons';
import { ApiError, Bouton, EntreeAnimee, useMouvementReduit, useStyles, useTheme, type Theme } from '@fleetpulse/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode, type SetStateAction } from 'react';
import { Animated, AppState, Platform, Text, View } from 'react-native';

export const POLICE_MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

/** Les lectures peuvent être répétées ; aucune mutation n'est rejouée automatiquement. */
export function useRessourcePartenaire<T>(lire: () => Promise<T>, intervalle = 30000) {
  const [donnees, setDonnees] = useState<T | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [horsConnexion, setHorsConnexion] = useState(false);
  const [chargement, setChargement] = useState(true);
  const actif = useRef(false), sequence = useRef(0);
  const charger = useCallback(async () => {
    const numero = ++sequence.current;
    if (!actif.current) return;
    setChargement(true);
    try {
      const valeur = await lire();
      if (actif.current && numero === sequence.current) { setDonnees(valeur); setErreur(null); setHorsConnexion(false); }
    } catch (e) {
      if (actif.current && numero === sequence.current) {
        setErreur(e instanceof Error ? e.message : 'Chargement impossible.');
        setHorsConnexion(e instanceof ApiError && e.status === 0);
      }
    } finally { if (actif.current && numero === sequence.current) setChargement(false); }
  }, [lire]);
  useFocusEffect(useCallback(() => {
    actif.current = true; void charger();
    const timer = setInterval(() => { if (AppState.currentState === 'active') void charger(); }, intervalle);
    const ecoute = AppState.addEventListener('change', etat => { if (etat === 'active') void charger(); });
    return () => { actif.current = false; sequence.current++; clearInterval(timer); ecoute.remove(); };
  }, [charger, intervalle]));
  const appliquer = useCallback((valeur: SetStateAction<T | null>) => { sequence.current++; setDonnees(valeur); setChargement(false); }, []);
  return { donnees, setDonnees: appliquer, erreur, chargement, horsConnexion, charger };
}

export function ErreurPartenaire({ message, horsConnexion = false, reessayer }: { message: string | null; horsConnexion?: boolean; reessayer: () => void }) {
  const t = useTheme();
  if (!message) return null;
  return <View accessibilityLiveRegion="polite" style={{ backgroundColor: t.erreurFond, padding: 16, borderRadius: 18, gap: 10 }}>
    <Text accessibilityRole="alert" style={{ color: t.erreur, fontSize: 15, lineHeight: 22 }}>{horsConnexion ? 'Hors connexion, nouvelle tentative…\n' : ''}{message}</Text>
    <Bouton titre="Réessayer" variante="secondaire" onPress={reessayer} />
  </View>;
}

export function SquelettePartenaire() {
  const t = useTheme();
  return <View accessible accessibilityLabel="Chargement en cours" style={{ gap: 12, paddingVertical: 16 }}>{[1, 2, 3].map(i => <View key={i} style={{ backgroundColor: t.surface, borderRadius: 20, padding: 20, gap: 12 }}><View style={{ width: '55%', height: 18, borderRadius: 6, backgroundColor: t.bordure }} /><View style={{ width: '85%', height: 12, borderRadius: 6, backgroundColor: t.surfaceAlt }} /></View>)}</View>;
}

/** État vectoriel léger : pas de fichier Lottie sans provenance/licence vérifiable. */
export function EtatPartenaire({ icone = 'receipt-outline', titre, texte, action }: { icone?: keyof typeof Ionicons.glyphMap; titre: string; texte: string; action?: ReactNode }) {
  const t = useTheme();
  return <EntreeAnimee><View style={{ alignItems: 'center', gap: 12, padding: 24 }}>
    <View style={{ padding: 20, backgroundColor: t.accentDoux, borderRadius: 32 }}><Ionicons name={icone} size={36} color={t.texte} /></View>
    <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: '800', color: t.texte, textAlign: 'center' }}>{titre}</Text>
    <Text style={{ fontSize: 15, lineHeight: 22, color: t.texte, textAlign: 'center' }}>{texte}</Text>{action}
  </View></EntreeAnimee>;
}

export function useMaintenant() {
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useFocusEffect(useCallback(() => {
    const timer = setInterval(() => { if (AppState.currentState === 'active') setMaintenant(Date.now()); }, 1000);
    return () => clearInterval(timer);
  }, []));
  return maintenant;
}
export function dureeLisible(secondes: number) {
  const s = Math.max(0, Math.floor(secondes));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
export function MinuteurCommande({ depuis, echeance, maintenant }: { depuis: string; echeance?: string | null; maintenant: number }) {
  const t = useTheme();
  const secondes = ((echeance ? Date.parse(echeance) : maintenant) - (echeance ? maintenant : Date.parse(depuis))) / 1000;
  return <Text style={{ fontSize: 15, fontFamily: POLICE_MONO, color: t.texte, fontWeight: '700' }}>{echeance ? secondes < 0 ? 'Retard ' : 'Reste ' : 'Attente '}{dureeLisible(Math.abs(secondes))}</Text>;
}

export function PointDirect({ actif }: { actif: boolean }) {
  const s = useStyles(stylesCommuns), t = useTheme(), reduit = useMouvementReduit();
  const [opacite] = useState(() => new Animated.Value(1));
  useEffect(() => {
    opacite.setValue(1);
    if (!actif || reduit) return;
    const boucle = Animated.loop(Animated.sequence([Animated.timing(opacite, { toValue: 0.45, duration: 1100, useNativeDriver: true }), Animated.timing(opacite, { toValue: 1, duration: 1100, useNativeDriver: true })]));
    boucle.start(); return () => boucle.stop();
  }, [actif, reduit, opacite]);
  return <View style={s.direct} accessibilityLiveRegion="polite"><Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.accent, opacity: opacite }} /><Text style={s.directTexte}>{actif ? 'En direct' : 'Direct interrompu'}</Text></View>;
}
const stylesCommuns = (t: Theme) => ({ direct: { flexDirection: 'row', alignItems: 'center', gap: 6 }, directTexte: { fontSize: 12, color: t.surface, fontWeight: '700' } } as const);
