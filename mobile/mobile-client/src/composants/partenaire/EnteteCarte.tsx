import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme';

/** En-tete des panneaux d'action du partenaire : pastille icone, titre fort et aide. */
export function EnteteCarte({ icone, titre, aide, ton = 'accent' }: {
  icone: keyof typeof Ionicons.glyphMap; titre: string; aide?: string; ton?: 'accent' | 'danger' | 'nuit';
}) {
  const fond = ton === 'danger' ? theme.erreurFond : ton === 'nuit' ? '#1B1C1F' : theme.accentDoux;
  const encre = ton === 'danger' ? theme.erreur : ton === 'nuit' ? theme.accent : '#7A4D00';
  return (
    <View style={styles.entete}>
      <View style={[styles.pastille, { backgroundColor: fond }]}><Ionicons name={icone} size={20} color={encre} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.titre} accessibilityRole="header">{titre}</Text>
        {aide ? <Text style={styles.aide}>{aide}</Text> : null}
      </View>
    </View>
  );
}

/** Heure a laquelle la commande sera prete si on annonce `minutes` maintenant. */
export function heureDans(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '--:--';
  const d = new Date(Date.now() + minutes * 60000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  entete: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  pastille: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  titre: { fontSize: 20, fontWeight: '800', color: theme.texte, letterSpacing: -0.4 },
  aide: { fontSize: 14, color: theme.secondaire, marginTop: 2, lineHeight: 19 },
});
