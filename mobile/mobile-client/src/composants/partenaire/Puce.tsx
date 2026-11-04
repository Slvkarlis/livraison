import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme';

/** Choix compact (filtre, temps de preparation, motif) ; compteur facultatif. */
export function Puce({ libelle, actif, onPress, compteur, desactive }: {
  libelle: string; actif: boolean; onPress: () => void; compteur?: number; desactive?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: actif, disabled: desactive }}
      disabled={desactive}
      onPress={onPress}
      style={[styles.puce, actif && styles.puceActive, desactive && styles.desactive]}
    >
      <Text style={[styles.texte, actif && styles.texteActif]}>{libelle}</Text>
      {compteur ? (
        <View style={[styles.compteur, actif && styles.compteurActif]}>
          <Text style={styles.compteurTexte}>{compteur}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  puce: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.bordure,
  },
  puceActive: { backgroundColor: theme.accent, borderColor: theme.accent },
  desactive: { opacity: 0.45 },
  texte: { fontSize: 14, fontWeight: '600', color: theme.texte },
  texteActif: { color: theme.surAccent },
  compteur: { minWidth: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: theme.accentDoux, alignItems: 'center' },
  compteurActif: { backgroundColor: theme.surAccent },
  compteurTexte: { fontSize: 12, fontWeight: '700', color: theme.accent },
});
