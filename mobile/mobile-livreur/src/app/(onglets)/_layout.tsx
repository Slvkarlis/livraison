import Ionicons from '@expo/vector-icons/Ionicons';
import { couleurIcone } from '@fleetpulse/shared';
import { Tabs } from 'expo-router';
import { theme } from '../../theme';

export default function OngletsLivreurLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.secondaire,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarStyle: { position: 'absolute', left: 16, right: 16, bottom: 18, height: 66, borderRadius: 22, backgroundColor: '#1F2126', borderTopWidth: 0, elevation: 14, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, paddingBottom: 10, paddingTop: 8 },
        sceneStyle: { backgroundColor: theme.fond },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Missions',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'bicycle' : 'bicycle-outline'} size={size} color={couleurIcone(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="caisse"
        options={{
          title: 'Caisse',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'wallet' : 'wallet-outline'} size={size} color={couleurIcone(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'person-circle' : 'person-circle-outline'} size={size} color={couleurIcone(color)} />
          ),
        }}
      />
    </Tabs>
  );
}
