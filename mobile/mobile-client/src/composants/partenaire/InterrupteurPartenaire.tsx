import { useTheme } from '@fleetpulse/shared';
import { Pressable, View } from 'react-native';

/** La zone entière mesure 60 × 48 dp, y compris sur l'aperçu web. */
export function InterrupteurPartenaire({ libelle, valeur, desactive = false, onChanger }: { libelle: string; valeur: boolean; desactive?: boolean; onChanger: (valeur: boolean) => void }) {
  const t = useTheme();
  return <Pressable accessibilityRole="switch" accessibilityLabel={libelle} accessibilityState={{ checked: valeur, disabled: desactive }} aria-checked={valeur} disabled={desactive} onPress={() => onChanger(!valeur)} style={({ pressed }) => ({ minWidth: 60, minHeight: 48, alignItems: 'center', justifyContent: 'center', opacity: desactive ? 0.5 : pressed ? 0.8 : 1 })}>
    <View style={{ width: 54, height: 30, borderRadius: 15, padding: 4, backgroundColor: valeur ? t.accent : t.bordure, alignItems: valeur ? 'flex-end' : 'flex-start' }}><View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: t.texte }} /></View>
  </Pressable>;
}
