import { AuthProvider, ConfigurationProvider, peutRole, Chargement, EcranServeurInjoignable, ThemeProvider, useAuth } from '@fleetpulse/shared';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { theme } from '../theme';

function Navigation() {
  const { profil, chargement, serveurInjoignable, reessayer, logout } = useAuth();
  if (chargement) return <Chargement />;
  if (serveurInjoignable) {
    return <EcranServeurInjoignable message={serveurInjoignable} onReessayer={reessayer} onDeconnexion={logout} />;
  }
  const connecte = profil !== null;
  const actif = peutRole(profil, 'LIVREUR');

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.fond } }}>
      <Stack.Protected guard={!connecte}>
        <Stack.Screen name="mot-de-passe-oublie" options={{ title: 'Mot de passe oublié', headerShown: true }} />
        <Stack.Screen name="candidature" options={{ title: 'Candidature', headerShown: true }} />
        <Stack.Screen name="connexion" />
      </Stack.Protected>
      <Stack.Protected guard={connecte && !actif}>
        <Stack.Screen name="dossier" options={{ title: 'Suivi du dossier', headerShown: true }} />
      </Stack.Protected>
      <Stack.Protected guard={actif}>
        <Stack.Screen name="index" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider theme={theme}>
      <AuthProvider role="LIVREUR">
        <StatusBar style="light" />
        <ConfigurationProvider><Navigation /></ConfigurationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
