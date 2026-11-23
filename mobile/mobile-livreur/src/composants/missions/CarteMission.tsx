import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressionnable, formatHeure, formatMontant, type Mission } from '@fleetpulse/shared';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme';

/** Ou en est la collecte : colis deja recupere, ou pret depuis quelle heure. */
function etatCollecte(m: Mission): string {
  if (m.recupereeLe) return ` · récupérée à ${formatHeure(new Date(m.recupereeLe))}`;
  if (m.preteLe) return ` · prête depuis ${formatHeure(new Date(m.preteLe))}`;
  return '';
}

/** Une mission de collecte dans la liste : commerce, adresse, client et montant a encaisser. */
export function CarteMission({ mission }: { mission: Mission }) {
  return (
    <Pressionnable
      accessibilityRole="button"
      accessibilityLabel={`Mission ${mission.codeSuivi}, ${mission.nomCommerce}`}
      onPress={() => router.push(`/mission/${mission.id}`)}
      style={styles.carte}
    >
      <View style={styles.icone}>
        <Ionicons name="storefront" size={20} color={theme.accent} />
      </View>
      <View style={styles.corps}>
        <Text style={styles.commerce}>{mission.nomCommerce}</Text>
        <Text style={styles.adresse} numberOfLines={1}>{mission.adresseCommerce}</Text>
        <Text style={styles.details}>
          {mission.clientPrenom} · {mission.nbArticles} article{mission.nbArticles > 1 ? 's' : ''}
          {etatCollecte(mission)}
        </Text>
      </View>
      <Text style={styles.montant}>{formatMontant(mission.montantACollecter)}</Text>
    </Pressionnable>
  );
}

const styles = StyleSheet.create({
  carte: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 24,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.bordure,
  },
  icone: {
    width: 46,
    height: 46,
    borderRadius: 16,
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
