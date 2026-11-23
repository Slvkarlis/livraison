import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Easing, PanResponder, StyleSheet, Text, View } from 'react-native';

const POUCE = 52;
const MARGE = 4;
const SEUIL = 0.82;

/**
 * Glisser pour confirmer (conception Doop « Direction 3 ») : le pouce ambre suit le doigt ;
 * relache au-dela de 82 % de la piste, l'action part, sinon il revient. Un lecteur d'ecran
 * peut aussi l'activer par double toucher (action « activate »).
 */
export function GlisserPourConfirmer({ libelle, onConfirmer, desactive = false, chargement = false, icone }: {
  libelle: string;
  onConfirmer: () => void;
  desactive?: boolean;
  chargement?: boolean;
  /** Icone du pouce (une fleche par defaut). */
  icone?: ReactNode;
}) {
  const [largeur, setLargeur] = useState(0);
  const [position] = useState(() => new Animated.Value(0));
  const [reflet] = useState(() => new Animated.Value(0));
  const course = Math.max(0, largeur - POUCE - 2 * MARGE);
  const bloque = desactive || chargement;

  // Reflet qui balaie le libelle tant que le geste est possible
  useEffect(() => {
    if (bloque) return;
    const boucle = Animated.loop(Animated.sequence([
      Animated.timing(reflet, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.delay(900),
      Animated.timing(reflet, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    boucle.start();
    return () => boucle.stop();
  }, [bloque, reflet]);

  // Fin d'envoi (succes ou echec) : le pouce revient au depart
  useEffect(() => {
    if (!chargement) Animated.spring(position, { toValue: 0, useNativeDriver: false, bounciness: 6 }).start();
  }, [chargement, position]);

  const geste = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !bloque,
    onMoveShouldSetPanResponder: (_e, g) => !bloque && Math.abs(g.dx) > 4,
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_e, g) => position.setValue(Math.max(0, Math.min(course, g.dx))),
    onPanResponderRelease: (_e, g) => {
      if (course > 0 && g.dx >= course * SEUIL) {
        Animated.timing(position, { toValue: course, duration: 140, useNativeDriver: false }).start(() => onConfirmer());
      } else {
        Animated.spring(position, { toValue: 0, useNativeDriver: false, bounciness: 8 }).start();
      }
    },
    onPanResponderTerminate: () => Animated.spring(position, { toValue: 0, useNativeDriver: false }).start(),
  }), [bloque, course, onConfirmer, position]);

  const max = Math.max(1, course);
  return (
    <View
      style={[styles.piste, desactive && styles.pisteInactive]}
      onLayout={(e) => setLargeur(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="button"
      accessibilityLabel={libelle}
      accessibilityHint="Glissez vers la droite, ou touchez deux fois, pour confirmer"
      accessibilityState={{ disabled: bloque, busy: chargement }}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={(e) => { if (e.nativeEvent.actionName === 'activate' && !bloque) onConfirmer(); }}
    >
      <Animated.View style={[styles.rempli, { width: Animated.add(position, POUCE + MARGE * 2) }]} />
      <Animated.View style={[styles.libelleCadre, { opacity: position.interpolate({ inputRange: [0, max * 0.6], outputRange: [1, 0], extrapolate: 'clamp' }) }]}>
        <Text style={[styles.libelle, desactive && styles.libelleInactif]} numberOfLines={1}>{chargement ? 'Envoi…' : libelle}</Text>
        {!bloque && largeur > 0 ? (
          <Animated.View pointerEvents="none" style={[styles.reflet, {
            transform: [{ translateX: reflet.interpolate({ inputRange: [0, 1], outputRange: [-80, largeur] }) }, { skewX: '-20deg' }],
          }]} />
        ) : null}
      </Animated.View>
      <Animated.View {...geste.panHandlers} style={[styles.pouce, desactive && styles.pouceInactif, { transform: [{ translateX: position }] }]}>
        {chargement ? <ActivityIndicator color="#15171A" /> : (icone ?? <Text style={[styles.fleche, desactive && styles.libelleInactif]}>→</Text>)}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  piste: { height: POUCE + MARGE * 2, borderRadius: 999, backgroundColor: '#2A2B2F', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(242,178,51,0.35)' },
  pisteInactive: { borderColor: 'rgba(255,255,255,0.08)' },
  rempli: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 999, backgroundColor: 'rgba(242,178,51,0.22)' },
  libelleCadre: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', paddingLeft: POUCE, overflow: 'hidden' },
  libelle: { color: '#F4F3EF', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  libelleInactif: { color: '#6B6F76' },
  reflet: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 46, backgroundColor: 'rgba(255,255,255,0.10)' },
  pouce: { position: 'absolute', left: MARGE, width: POUCE, height: POUCE, borderRadius: POUCE / 2, backgroundColor: '#F2B233', alignItems: 'center', justifyContent: 'center', shadowColor: '#F2B233', shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  fleche: { fontSize: 24, fontWeight: '800', color: '#15171A', marginTop: -2 },
  pouceInactif: { backgroundColor: '#3A3C42', shadowOpacity: 0, elevation: 0 },
});
