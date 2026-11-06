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
        tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.bordure },
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
