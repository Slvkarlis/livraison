import { AuthProvider, Chargement, ThemeProvider, useAuth } from '@fleetpulse/shared';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { theme } from '../theme';

function Navigation() {
  const { profil, chargement } = useAuth();
  if (chargement) return <Chargement />;
  const connecte = profil !== null;

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
      <Stack.Protected guard={!connecte}>
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
      <Stack.Protected guard={connecte}>
        <Stack.Screen name="(onglets)" options={{ headerShown: false }} />
        <Stack.Screen name="nouvelle-commande" options={{ title: 'Nouvelle commande' }} />
        <Stack.Screen
          name="choisir-adresse"
          options={{ title: 'Adresse de livraison', headerStyle: { backgroundColor: theme.surface } }}
        />
        <Stack.Screen name="commande/[id]" options={{ title: '', headerTransparent: true }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider theme={theme}>
      <AuthProvider role="CLIENT">
        <StatusBar style="dark" />
        <Navigation />
      </AuthProvider>
    </ThemeProvider>
  );
}
