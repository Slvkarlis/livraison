import Ionicons from '@expo/vector-icons/Ionicons';
import { useEvenementsCommandes } from '@fleetpulse/shared';
import { useAudioPlayer } from 'expo-audio';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../theme';

// Ressource audio locale generee pour le projet (expo-audio accepte require)
const SON = require('../../../assets/nouvelle-commande.wav');
const DUREE_AFFICHAGE_MS = 12000;

// US-2B1 : alerte temps reel d'une nouvelle commande (bandeau + son), visible sur tous les ecrans du partenaire
export function AlerteNouvelleCommande() {
  const [commandeId, setCommandeId] = useState<number | null>(null);
  const son = useAudioPlayer(SON);
  const marges = useSafeAreaInsets();

  useEvenementsCommandes((e) => {
    if (e.ancien !== null) return;
    setCommandeId(e.commandeId);
    // Navigateur : le son n'est autorise qu'apres une premiere interaction (la connexion en est une)
    void son.seekTo(0).then(() => son.play()).catch(() => {});
  });

  useEffect(() => {
    if (commandeId === null) return;
    const minuterie = setTimeout(() => setCommandeId(null), DUREE_AFFICHAGE_MS);
    return () => clearTimeout(minuterie);
  }, [commandeId]);

  if (commandeId === null) return null;
  return (
    <View pointerEvents="box-none" style={[styles.zone, { top: marges.top + 8 }]}>
      <Pressable
        accessibilityRole="alert"
        accessibilityLabel="Nouvelle commande reçue, ouvrir"
        onPress={() => { setCommandeId(null); router.push(`/partenaire/commande/${commandeId}`); }}
        style={({ pressed }) => [styles.bandeau, pressed && { opacity: 0.9 }]}
      >
        <View style={styles.icone}>
          <Ionicons name="notifications" size={20} color={theme.accent} />
        </View>
        <View style={styles.texte}>
          <Text style={styles.titre}>Nouvelle commande reçue</Text>
          <Text style={styles.sousTitre}>Touchez pour l’ouvrir et l’accepter</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Fermer l'alerte" hitSlop={12} onPress={() => setCommandeId(null)}>
          <Ionicons name="close" size={22} color={theme.surAccent} />
        </Pressable>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { position: 'absolute', left: 12, right: 12, zIndex: 10 },
  bandeau: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: theme.accent,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  icone: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.surAccent, alignItems: 'center', justifyContent: 'center' },
  texte: { flex: 1 },
  titre: { fontSize: 16, fontWeight: '700', color: theme.surAccent },
  sousTitre: { fontSize: 13, color: theme.surAccent, opacity: 0.85, marginTop: 2 },
});
