import { AccentProvider, AuthProvider, Chargement, couleurs, useAuth } from '@fleetpulse/shared';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ACCENT } from '../theme';

function Navigation() {
  const { profil, chargement } = useAuth();
  if (chargement) return <Chargement />;
  const connecte = profil !== null;

  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerTintColor: ACCENT,
        headerTitleStyle: { color: couleurs.texte },
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: couleurs.fond },
      }}
    >
      <Stack.Protected guard={!connecte}>
        <Stack.Screen name="connexion" options={{ headerShown: false }} />
        <Stack.Screen name="inscription" options={{ title: '' }} />
      </Stack.Protected>
      <Stack.Protected guard={connecte}>
        <Stack.Screen name="(onglets)" options={{ headerShown: false }} />
        <Stack.Screen name="nouvelle-commande" options={{ title: 'Nouvelle commande' }} />
        <Stack.Screen name="commande/[id]" options={{ title: 'Commande' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AccentProvider couleur={ACCENT}>
      <AuthProvider role="CLIENT">
        <StatusBar style="dark" />
        <Navigation />
      </AuthProvider>
    </AccentProvider>
  );
}
