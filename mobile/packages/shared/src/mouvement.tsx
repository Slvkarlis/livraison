import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, type StyleProp, type ViewStyle } from 'react-native';

/** Entree en fondu avec montee douce, decalee selon le rang (liste echelonnee). */
export function EntreeAnimee({ rang = 0, children, style }: { rang?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const valeur = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    Animated.timing(valeur, {
      toValue: 1,
      duration: 480,
      delay: Math.min(rang, 8) * 70,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [rang, valeur]);
  return (
    <Animated.View
      style={[style, {
        opacity: valeur,
        transform: [{ translateY: valeur.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
      }]}
    >
      {children}
    </Animated.View>
  );
}

/** Bouton qui se contracte legerement a la pression : retour tactile visible. */
export function Pressionnable({ onPress, children, style, disabled, accessibilityRole, accessibilityLabel }: {
  onPress?: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  accessibilityRole?: 'button' | 'link';
  accessibilityLabel?: string;
}) {
  const echelle = useState(() => new Animated.Value(1))[0];
  const animer = (vers: number) => Animated.spring(echelle, { toValue: vers, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      onPressIn={() => animer(0.97)}
      onPressOut={() => animer(1)}
    >
      <Animated.View style={[style, { transform: [{ scale: echelle }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
