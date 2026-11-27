import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressionnable } from '@fleetpulse/shared';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { theme } from '../../theme';
import type { EtatNavigation } from './carteNavigationPage';

export interface CarteNavigationProps { etat: EtatNavigation | null; style?: StyleProp<ViewStyle> }

/** Boutons flottants : vue d'ensemble du trajet, et « Recentrer » quand le livreur a deplace la carte. */
export function BoutonsCarte({ libre, onRecentrer, onEnsemble }: { libre: boolean; onRecentrer: () => void; onEnsemble: () => void }) {
  return (
    <View style={styles.boutons} pointerEvents="box-none">
      <Pressionnable onPress={onEnsemble} accessibilityRole="button" accessibilityLabel="Voir tout le trajet" style={styles.rond}>
        <Ionicons name="map-outline" size={20} color="#1F1F1F" />
      </Pressionnable>
      {libre ? (
        <Pressionnable onPress={onRecentrer} accessibilityRole="button" accessibilityLabel="Recentrer sur ma position" style={styles.recentrer}>
          <Ionicons name="navigate" size={16} color="#FFFFFF" />
          <Text style={styles.recentrerTexte}>Recentrer</Text>
        </Pressionnable>
      ) : null}
    </View>
  );
}

export function VoileCarte({ statut }: { statut: 'chargement' | 'pret' | 'erreur' }) {
  if (statut === 'pret') return null;
  return (
    <View pointerEvents="none" style={styles.voile}>
      <Text style={styles.voileTexte}>
        {statut === 'erreur' ? 'Carte indisponible : vérifiez la connexion internet.' : 'Chargement de la carte…'}
      </Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  conteneur: { overflow: 'hidden', backgroundColor: '#E8E6E1' },
  carte: { flex: 1, backgroundColor: '#E8E6E1' },
  boutons: { position: 'absolute', right: 14, bottom: 60, alignItems: 'flex-end', gap: 10 },
  rond: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  recentrer: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, height: 44, borderRadius: 22,
    backgroundColor: '#1A73E8', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  recentrerTexte: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  voile: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8E6E1', padding: 24 },
  voileTexte: { fontSize: 14, color: theme.secondaire, textAlign: 'center' },
});
