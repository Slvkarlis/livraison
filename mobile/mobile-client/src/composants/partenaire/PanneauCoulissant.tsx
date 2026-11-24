import { useMouvementReduit, useTheme } from '@fleetpulse/shared';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Puce } from './Puce';

/** Seule la poignée prend le geste : le défilement des articles garde son comportement natif. */
export function PanneauCoulissant({ resume, children, initial = 1, libelles = ['Résumé', 'Articles', 'Tout voir'] }: { resume: ReactNode; children: ReactNode; initial?: number; libelles?: readonly [string, string, string] }) {
  const t = useTheme(), reduit = useMouvementReduit();
  const [hauteur, setHauteur] = useState(600), [position, setPosition] = useState(initial);
  const points = useMemo(() => [Math.max(0, hauteur - 190), Math.max(0, hauteur * 0.42), 0], [hauteur]);
  const y = useSharedValue(points[initial]), depart = useSharedValue(0);
  useEffect(() => { y.set(withTiming(points[position], { duration: reduit ? 0 : 220 })); }, [position, points, reduit, y]);
  const geste = useMemo(() => Gesture.Pan().activeOffsetY([-8, 8]).onBegin(() => { depart.set(y.get()); }).onUpdate(e => {
    y.set(Math.max(0, Math.min(points[0], depart.get() + e.translationY)));
  }).onEnd(e => {
    const projection = y.get() + e.velocityY * 0.12;
    let index = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(points[i] - projection) < Math.abs(points[index] - projection)) index = i;
    y.set(withTiming(points[index], { duration: reduit ? 0 : 220 }));
    scheduleOnRN(setPosition, index);
  }).onFinalize((_e, succes) => { if (!succes) y.set(withTiming(points[position], { duration: reduit ? 0 : 220 })); }), [depart, points, position, reduit, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }], height: hauteur - y.value }));
  return <View style={{ flex: 1, overflow: 'hidden' }} onLayout={e => setHauteur(e.nativeEvent.layout.height)}>
    <Animated.View style={[{ backgroundColor: t.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: t.bordure, overflow: 'hidden' }, style]}>
      <GestureDetector gesture={geste} touchAction="none"><View testID="poignee-commande" collapsable={false} accessible accessibilityRole="adjustable" accessibilityLabel="Hauteur du panneau de commande" accessibilityHint="Glissez la poignée, ou utilisez les boutons Résumé, Articles et Tout voir" accessibilityValue={{ min: 0, max: 2, now: position, text: libelles[position] }} accessibilityActions={[{ name: 'increment', label: 'Développer' }, { name: 'decrement', label: 'Replier' }]} onAccessibilityAction={e => setPosition(avant => Math.max(0, Math.min(2, avant + (e.nativeEvent.actionName === 'increment' ? 1 : -1))))} style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: t.secondaire }} /></View></GestureDetector>
      <View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 12 }}>{resume}<View style={{ flexDirection: 'row', gap: 6 }}>{libelles.map((titre, i) => <Puce key={titre} libelle={titre} actif={position === i} onPress={() => setPosition(i)} />)}</View></View>
      {position > 0 ? <View style={{ flex: 1 }}>{children}</View> : <Text style={{ color: t.texte, paddingHorizontal: 16, fontSize: 13 }}>Développez pour lire les articles et répondre.</Text>}
    </Animated.View>
  </View>;
}
