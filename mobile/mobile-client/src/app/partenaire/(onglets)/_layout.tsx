import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { couleurIcone } from '../../../composants/couleurIcone';
import { theme } from '../../../theme';

export default function OngletsPartenaireLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.secondaire,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarStyle: { backgroundColor: theme.surface, borderTopWidth: 0, elevation: 12, shadowOpacity: 0.06 },
        sceneStyle: { backgroundColor: theme.fond },
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
    </Tabs>
  );
}
