import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { couleurIcone, useTheme } from '@fleetpulse/shared';

export default function OngletsPartenaireLayout() {
  const theme = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.fond,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700', marginTop: 2 },
        tabBarStyle: { position: 'absolute', left: 16, right: 16, bottom: 18, height: 76, borderRadius: 26, backgroundColor: theme.texte, borderTopWidth: 0, elevation: 14, shadowColor: theme.texte, shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, paddingBottom: 12, paddingTop: 10 },
        tabBarItemStyle: { borderRadius: 16 },
        // La barre flotte : on reserve sa hauteur sous le contenu
        sceneStyle: { backgroundColor: theme.fond, paddingBottom: 100 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Commandes',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'receipt' : 'receipt-outline'} size={size} color={couleurIcone(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="catalogue"
        options={{
          title: 'Catalogue',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'pricetags' : 'pricetags-outline'} size={size} color={couleurIcone(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: 'Profil',
          tabBarAccessibilityLabel: 'Profil du commerce',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'storefront' : 'storefront-outline'} size={size} color={couleurIcone(color)} />
          ),
        }}
      />
      <Tabs.Screen name="ventes" options={{ title: 'Ventes', tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart-outline" size={size} color={couleurIcone(color)} /> }} />
    </Tabs>
  );
}
