import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { couleurIcone } from '@fleetpulse/shared';
import { theme } from '../../theme';

export default function OngletsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: '#9A9EA6',
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarStyle: { position: 'absolute', left: 16, right: 16, bottom: 18, height: 66, borderRadius: 22, backgroundColor: '#15171A', borderTopWidth: 0, elevation: 14, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, paddingBottom: 10, paddingTop: 8 },
        tabBarItemStyle: { borderRadius: 16 },
        sceneStyle: { backgroundColor: theme.fond },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Commandes',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'bag-handle' : 'bag-handle-outline'} size={size} color={couleurIcone(color)} />
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
