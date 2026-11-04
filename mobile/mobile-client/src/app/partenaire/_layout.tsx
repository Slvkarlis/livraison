import { Stack } from 'expo-router';
import { theme } from '../../theme';

// Espace partenaire (Sprint 2 bis) : onglets + detail d'une commande recue.
export default function PartenaireLayout() {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerTintColor: theme.accent,
        headerTitleStyle: { color: theme.texte, fontWeight: '700' },
        headerStyle: { backgroundColor: theme.fond },
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: theme.fond },
      }}
    >
      <Stack.Screen name="(onglets)" options={{ headerShown: false }} />
      <Stack.Screen name="commande/[id]" options={{ title: 'Commande reçue' }} />
    </Stack>
  );
}
