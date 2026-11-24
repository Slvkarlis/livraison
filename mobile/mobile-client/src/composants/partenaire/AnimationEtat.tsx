import Ionicons from '@expo/vector-icons/Ionicons';
import { useMouvementReduit, useTheme } from '@fleetpulse/shared';
import { useEffect } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

/** Icône existante, mouvement court : pas de fichier d'animation téléchargé sans licence. */
export function AnimationEtat({ etat }: { etat: 'nouvelle' | 'prete' | 'vide' | 'impression' }) {
  const t = useTheme(), reduit = useMouvementReduit(), rotation = useSharedValue(0);
  useEffect(() => {
    rotation.value = reduit ? 0 : withRepeat(withSequence(withTiming(-8, { duration: 130 }), withTiming(8, { duration: 130 }), withTiming(0, { duration: 130 })), 2, false);
  }, [etat, reduit, rotation]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotateZ: `${rotation.value}deg` }] }));
  return <Animated.View accessible={false} style={style}><Ionicons name={{ nouvelle: 'notifications', prete: 'bag-check', vide: 'search-outline', impression: 'checkmark-circle' }[etat] as keyof typeof Ionicons.glyphMap} size={32} color={t.texte} /></Animated.View>;
}
