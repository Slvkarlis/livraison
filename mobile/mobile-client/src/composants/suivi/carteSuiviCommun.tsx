import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressionnable } from '@fleetpulse/shared';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { EtatSuivi } from './carteSuiviPage';

export interface CarteSuiviProps { etat: EtatSuivi | null; style?: StyleProp<ViewStyle> }

/** « Recentrer » quand le client a deplace la carte : revient au cadrage livreur + maison. */
export function BoutonRecentrer({ visible, onPress }: { visible: boolean; onPress: () => void }) {
  if (!visible) return null;
  return (
    <Pressionnable onPress={onPress} accessibilityRole="button" accessibilityLabel="Recentrer sur le livreur" style={styles.recentrer}>
      <Ionicons name="locate" size={16} color="#FFFFFF" />
      <Text style={styles.recentrerTexte}>Recentrer</Text>
    </Pressionnable>
  );
}

export function VoileSuivi({ statut }: { statut: 'chargement' | 'pret' | 'erreur' }) {
  if (statut === 'pret') return null;
  return (
    <View pointerEvents="none" style={styles.voile}>
      <Text style={styles.voileTexte}>{statut === 'erreur' ? 'Carte indisponible : vérifiez la connexion internet.' : 'Chargement de la carte…'}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  conteneur: { overflow: 'hidden', backgroundColor: '#ECEAE4' },
  carte: { flex: 1, backgroundColor: '#ECEAE4' },
  recentrer: { position: 'absolute', right: 14, bottom: 46, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14,
    height: 40, borderRadius: 20, backgroundColor: '#15171A', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  recentrerTexte: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  voile: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ECEAE4', padding: 24 },
  voileTexte: { fontSize: 14, color: '#6B6F76', textAlign: 'center' },
});
