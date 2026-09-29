import { AccentProvider, AuthProvider, Chargement, couleurs, useAuth } from '@fleetpulse/shared';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ACCENT } from '../theme';

function Navigation() {
  const { profil, chargement } = useAuth();
  if (chargement) return <Chargement />;
  const connecte = profil !== null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: couleurs.fond } }}>
      <Stack.Protected guard={!connecte}>
        <Stack.Screen name="connexion" />
      </Stack.Protected>
      <Stack.Protected guard={connecte}>
        <Stack.Screen name="index" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AccentProvider couleur={ACCENT}>
      <AuthProvider role="LIVREUR">
        <StatusBar style="dark" />
        <Navigation />
      </AuthProvider>
    </AccentProvider>
  );
}
