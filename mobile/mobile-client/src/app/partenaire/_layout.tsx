import { Stack } from 'expo-router';
import { View } from 'react-native';
import { AlerteNouvelleCommande } from '../../composants/partenaire/AlerteNouvelleCommande';
import { theme } from '../../theme';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PreferencesPartenaireProvider } from '../../composants/partenaire/PreferencesPartenaire';

// Espace partenaire (Sprint 2 bis) : onglets + detail d'une commande recue ; alerte temps reel par-dessus tous les ecrans.
export default function PartenaireLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}><PreferencesPartenaireProvider><View style={{ flex: 1 }}>
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
        <Stack.Screen name="etiquette/[id]" options={{ title: 'Étiquette du colis' }} />
      </Stack>
      <AlerteNouvelleCommande />
    </View></PreferencesPartenaireProvider></GestureHandlerRootView>
  );
}
