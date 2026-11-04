import { AuthProvider, ConfigurationProvider, peutRole, Chargement, EcranServeurInjoignable, ThemeProvider, useAuth } from '@fleetpulse/shared';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { theme } from '../theme';
import { MarcheSession } from '../marche-session';
import { useEffect } from 'react';
import { definirAdresse } from '../brouillon';

function Navigation() {
  const { profil, chargement, serveurInjoignable, reessayer, logout } = useAuth();
  useEffect(() => { definirAdresse(null); }, [profil?.id]);
  if (chargement) return <Chargement />;
  if (serveurInjoignable) {
    return <EcranServeurInjoignable message={serveurInjoignable} onReessayer={reessayer} onDeconnexion={logout} />;
  }
  const connecte = profil !== null;
  const actif = peutRole(profil, 'CLIENT');
  const partenaire = peutRole(profil, 'PARTENAIRE');

  return (
    <MarcheSession key={profil?.id ?? 'anonyme'}><Stack
      screenOptions={{
        headerShadowVisible: false,
        headerTintColor: theme.accent,
        headerTitleStyle: { color: theme.texte, fontWeight: '700' },
        headerStyle: { backgroundColor: theme.fond },
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: theme.fond },
      }}
    >
      <Stack.Protected guard={!connecte}>
        <Stack.Screen name="mot-de-passe-oublie" options={{ title: 'Mot de passe oublié', headerShown: true }} />
        <Stack.Screen name="candidature" options={{ title: 'Candidature', headerShown: true }} />
        <Stack.Screen name="connexion" options={{ headerShown: false }} />
        <Stack.Screen
          name="inscription"
          options={{
            title: '',
            headerStyle: { backgroundColor: theme.surface },
            contentStyle: { backgroundColor: theme.surface },
          }}
        />
      </Stack.Protected>
      <Stack.Protected guard={connecte && !actif && !partenaire}>
        <Stack.Screen name="dossier" options={{ title: 'Suivi du dossier', headerShown: true }} />
      </Stack.Protected>
      <Stack.Protected guard={partenaire}>
        <Stack.Screen name="partenaire" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={actif}>
        <Stack.Screen name="(onglets)" options={{ headerShown: false }} />
        <Stack.Screen name="nouvelle-commande" options={{ title: 'Nouvelle commande' }} />
        <Stack.Screen
          name="choisir-adresse"
          options={{ title: 'Adresse de livraison', headerStyle: { backgroundColor: theme.surface } }}
        />
        <Stack.Screen name="commande/[id]" options={{ title: '', headerTransparent: true }} />
      </Stack.Protected>
    </Stack></MarcheSession>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider theme={theme}>
      <AuthProvider role="CLIENT">
        <StatusBar style="dark" />
        <ConfigurationProvider><Navigation /></ConfigurationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
