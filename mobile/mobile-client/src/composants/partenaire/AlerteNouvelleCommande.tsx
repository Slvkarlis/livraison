import Ionicons from '@expo/vector-icons/Ionicons';
import { useEvenementsCommandes, useTheme } from '@fleetpulse/shared';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePreferencesPartenaire } from './PreferencesPartenaire';

const SON = require('../../../assets/nouvelle-commande.wav');

export function AlerteNouvelleCommande() {
  const t = useTheme(), { preferences, pret } = usePreferencesPartenaire(), marges = useSafeAreaInsets();
  const [file, setFile] = useState<number[]>([]), [erreurSon, setErreurSon] = useState(false);
  const recus = useRef(new Set<number>()), modeAudio = useRef<Promise<void>>(Promise.resolve());
  const son = useAudioPlayer(SON);
  useEffect(() => {
    modeAudio.current = setAudioModeAsync({ playsInSilentMode: false, shouldPlayInBackground: false, interruptionMode: 'mixWithOthers' });
    void modeAudio.current.catch(() => setErreurSon(true));
  }, []);
  useEffect(() => { if (!preferences.son) son.pause(); }, [preferences.son, son]);
  useEvenementsCommandes(e => {
    if (e.ancien !== null) { setFile(avant => avant.filter(id => id !== e.commandeId)); return; }
    if (recus.current.has(e.commandeId)) return;
    recus.current.add(e.commandeId); setFile(avant => [...avant, e.commandeId]);
    if (AppState.currentState !== 'active') return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    if (pret && preferences.son) void modeAudio.current.then(async () => { await son.seekTo(0); son.play(); }).catch(() => setErreurSon(true));
  });
  if (!file.length) return null;
  return <View style={{ position: 'absolute', top: marges.top + 8, left: 12, right: 12, zIndex: 20, borderRadius: 20, backgroundColor: t.accent, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Ouvrir la nouvelle commande ${file[0]}`} onPress={() => { const id = file[0]; setFile(avant => avant.slice(1)); router.push(`/partenaire/commande/${id}`); }} style={{ flex: 1, minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8 }}>
      <Ionicons name="notifications" size={26} color={t.surAccent} /><View style={{ flex: 1 }} accessibilityLiveRegion="assertive"><Text style={{ color: t.surAccent, fontSize: 17, fontWeight: '800' }}>{file.length > 1 ? `${file.length} nouvelles commandes` : 'Nouvelle commande reçue'}</Text><Text style={{ color: t.surAccent, fontSize: 13, marginTop: 4 }}>{erreurSon ? 'Son indisponible · touchez pour ouvrir' : 'Touchez pour répondre'}</Text></View>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Masquer cette alerte, la commande reste dans Commandes" onPress={() => setFile(avant => avant.slice(1))} style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="close" size={24} color={t.surAccent} /></Pressable>
  </View>;
}
