import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@fleetpulse/shared';
import { Text, View } from 'react-native';

export function EnteteCarte({ icone, titre, aide, ton = 'accent' }: { icone: keyof typeof Ionicons.glyphMap; titre: string; aide?: string; ton?: 'accent' | 'danger' | 'nuit' }) {
  const t = useTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}><View style={{ width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: ton === 'danger' ? t.erreurFond : ton === 'nuit' ? t.texte : t.accentDoux }}><Ionicons name={icone} size={22} color={ton === 'danger' ? t.erreur : ton === 'nuit' ? t.accent : t.texte} /></View><View style={{ flex: 1 }}><Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: '800', color: t.texte }}>{titre}</Text>{aide ? <Text style={{ fontSize: 14, color: t.texte, lineHeight: 20, marginTop: 4 }}>{aide}</Text> : null}</View></View>;
}
export function heureDans(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '--:--';
  return new Date(Date.now() + minutes * 60000).toLocaleTimeString('fr-FR', { timeZone: 'Africa/Tunis', hour: '2-digit', minute: '2-digit' });
}
