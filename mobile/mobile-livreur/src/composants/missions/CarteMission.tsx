import Ionicons from '@expo/vector-icons/Ionicons';
import { formatHeure, formatMontant, type Mission } from '@fleetpulse/shared';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme';

/** Une mission de collecte dans la liste : commerce, adresse, client et montant a encaisser. */
export function CarteMission({ mission }: { mission: Mission }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Mission ${mission.codeSuivi} chez ${mission.nomCommerce}`}
      onPress={() => router.push(`/mission/${mission.id}`)}
      style={({ pressed }) => [styles.carte, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.icone}>
        <Ionicons name="storefront-outline" size={20} color={theme.accent} />
      </View>
      <View style={styles.corps}>
        <Text style={styles.commerce}>{mission.nomCommerce}</Text>
        <Text style={styles.adresse} numberOfLines={1}>{mission.adresseCommerce}</Text>
        <Text style={styles.details}>
          {mission.clientPrenom} · {mission.nbArticles} article{mission.nbArticles > 1 ? 's' : ''}
          {mission.preteLe ? ` · prête depuis ${formatHeure(new Date(mission.preteLe))}` : ''}
        </Text>
      </View>
      <Text style={styles.montant}>{formatMontant(mission.montantACollecter)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  carte: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: theme.rayon,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.bordure,
  },
  icone: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: theme.accentDoux,
    alignItems: 'center',
    justifyContent: 'center',
  },
  corps: { flex: 1, gap: 2 },
  commerce: { fontSize: 16, fontWeight: '700', color: theme.texte },
  adresse: { fontSize: 14, color: theme.secondaire },
  details: { fontSize: 13, color: theme.secondaire },
  montant: { fontSize: 15, fontWeight: '800', color: theme.accent },
});
