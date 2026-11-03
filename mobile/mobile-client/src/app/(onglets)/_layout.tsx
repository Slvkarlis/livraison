import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { theme } from '../../theme';

/** Ionicons n'accepte qu'une string : conversion securisee de la couleur fournie par la barre d'onglets. */
function couleurIcone(color: unknown): string | undefined {
  if (typeof color === 'string') return color;
  if (typeof color === 'number') return `#${color.toString(16).padStart(8, '0')}`;
  return undefined;
}

export default function OngletsLayout() {
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
