import { useTheme } from '@fleetpulse/shared';
import { Pressable, Text } from 'react-native';

export function Puce({ libelle, actif, compteur, desactive = false, onPress }: { libelle: string; actif: boolean; compteur?: number; desactive?: boolean; onPress: () => void }) {
  const t = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={`${libelle}${compteur !== undefined ? `, ${compteur} commande(s)` : ''}`} accessibilityState={{ selected: actif, disabled: desactive }} aria-selected={actif} disabled={desactive} onPress={onPress}
    style={({ pressed }) => ({ minHeight: 48, minWidth: 48, paddingHorizontal: 10, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, borderWidth: 1, backgroundColor: actif ? t.accent : t.surface, borderColor: actif ? t.accent : t.bordure, opacity: desactive ? 0.5 : pressed ? 0.8 : 1 })}>
    <Text style={{ color: actif ? t.surAccent : t.texte, fontWeight: '700', fontSize: 14 }}>{libelle}</Text>
    {compteur !== undefined ? <Text style={{ color: actif ? t.surAccent : t.texte, fontWeight: '800', fontSize: 14, fontVariant: ['tabular-nums'] }}>{compteur}</Text> : null}
  </Pressable>;
}
