import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { couleurIcone } from '@fleetpulse/shared';
import { theme } from '../../../theme';

export default function OngletsPartenaireLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: '#9A9EA6',
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700', marginTop: 2 },
        tabBarStyle: { position: 'absolute', left: 16, right: 16, bottom: 18, height: 76, borderRadius: 26, backgroundColor: '#15171A', borderTopWidth: 0, elevation: 14, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, paddingBottom: 12, paddingTop: 10 },
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
          title: 'Commerce',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'storefront' : 'storefront-outline'} size={size} color={couleurIcone(color)} />
          ),
        }}
      />
      <Tabs.Screen name="ventes" options={{ title: 'Ventes', tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart-outline" size={size} color={couleurIcone(color)} /> }} />
    </Tabs>
  );
}
