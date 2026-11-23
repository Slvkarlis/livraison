import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Polygon, Rect, Stop } from 'react-native-svg';

/*
 * Ville 3D (conception Doop « CityMap3D », version mobile) : quartier en projection isometrique,
 * immeubles extrudes qui s'elevent a l'ouverture, itineraire ambre en pointilles qui defile,
 * reperes avec onde, legere derive de camera. Uniquement react-native et react-native-svg.
 */

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const COS = Math.cos(Math.PI / 6);
const SIN = Math.sin(Math.PI / 6);
const ECHELLE = 0.62;
type Pt = [number, number];
const projeter = (x: number, y: number, z = 0): Pt => [(x - y) * COS * ECHELLE + 400, (x + y) * SIN * ECHELLE - z * ECHELLE + 60];
const poly = (pts: Pt[]) => pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ');

/** Hauteurs fixes (pas d'aleatoire : le rendu est identique a chaque ouverture). 0 = place ou jardin. */
const HAUTEURS = [
  [34, 70, 18, 52, 0, 26],
  [22, 0, 88, 30, 44, 60],
  [56, 28, 40, 0, 120, 20],
  [16, 64, 24, 36, 30, 74],
  [44, 0, 96, 18, 58, 26],
  [28, 52, 20, 66, 14, 40],
];
const CELLULE = 100;
const MARGE = 13;
/** Itineraire le long des rues (multiples de 100). */
const TRAJET: [number, number][] = [[100, 600], [100, 400], [300, 400], [300, 200], [500, 200], [500, 100]];

type Couleurs = { haut: string; gauche: string; droite: string; arete: string; sol: string; rue: string; place: string; fond: [string, string] };
const TONS: Record<'nuit' | 'jour', Couleurs> = {
  nuit: { haut: '#30333A', gauche: '#1A1B1F', droite: '#24262B', arete: '#3B3E45', sol: '#1E2024', rue: '#16171A', place: '#22282A', fond: ['#26282D', '#141518'] },
  jour: { haut: '#FFFFFF', gauche: '#D3D1CA', droite: '#E5E3DD', arete: '#DADAD5', sol: '#E4E3DE', rue: '#D9D8D2', place: '#DCE3DD', fond: ['#F2F1ED', '#DFDED9'] },
};

function useMouvementReduit() {
  const [reduit, setReduit] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduit);
    const ecoute = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduit);
    return () => ecoute.remove();
  }, []);
  return reduit;
}

/** Sur le web, react-native-svg anime mal ses attributs (avertissements « collapsable ») : trace fixe. */
const SVG_ANIME = Platform.OS !== 'web';

export function Ville3D({ ton = 'nuit', style, progression = 0.55, fondu }: {
  ton?: 'nuit' | 'jour';
  /** Couleur du support : le fond prend cette couleur et la ville s'y fond par la gauche (bandeaux). */
  fondu?: string;
  style?: StyleProp<ViewStyle>;
  /** Part du trajet deja parcourue (0 a 1) : place le livreur sur l'itineraire. */
  progression?: number;
}) {
  const c = TONS[ton];
  // Identifiants de degrade propres a chaque ville : sur le web, deux villes ne doivent pas partager « #fond »
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const idFond = `fond-${uid}`; const idFondu = `fondu-${uid}`;
  const reduit = useMouvementReduit();
  const [anime, setAnime] = useState(0);
  const elevation = reduit ? 1 : anime;
  const defile = useState(() => new Animated.Value(0))[0];
  const onde = useState(() => new Animated.Value(0))[0];
  const derive = useState(() => new Animated.Value(0))[0];

  // Les immeubles s'elevent (une fois), puis la route defile et la camera derive en boucle
  useEffect(() => {
    if (reduit) return;
    let image = 0;
    const t0 = Date.now();
    const pas = () => {
      const p = Math.min(1, (Date.now() - t0) / 1300);
      setAnime(1 - Math.pow(1 - p, 3));
      if (p < 1) image = requestAnimationFrame(pas);
    };
    image = requestAnimationFrame(pas);
    const boucles = [
      ...(SVG_ANIME ? [
        Animated.loop(Animated.timing(defile, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: false })),
        Animated.loop(Animated.timing(onde, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: false })),
      ] : []),
      Animated.loop(Animated.sequence([
        Animated.timing(derive, { toValue: 1, duration: 9000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(derive, { toValue: 0, duration: 9000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])),
    ];
    boucles.forEach((b) => b.start());
    return () => { cancelAnimationFrame(image); boucles.forEach((b) => b.stop()); };
  }, [reduit, defile, onde, derive]);

  const blocs = useMemo(() => {
    const liste: { i: number; j: number; h: number }[] = [];
    HAUTEURS.forEach((ligne, j) => ligne.forEach((h, i) => liste.push({ i, j, h })));
    return liste.sort((a, b) => a.i + a.j - (b.i + b.j));
  }, []);

  const trace = TRAJET.map(([x, y], k) => `${k ? 'L' : 'M'}${projeter(x, y).join(' ')}`).join(' ');
  const position = pointSurTrajet(progression);
  const [px, py] = projeter(position[0], position[1]);
  const [ax, ay] = projeter(...TRAJET[TRAJET.length - 1]);
  const [dx, dy] = projeter(...TRAJET[0]);
  const sol = poly([projeter(0, 0), projeter(600, 0), projeter(600, 600), projeter(0, 600)]);

  return (
    <View style={[styles.cadre, fondu ? { backgroundColor: fondu } : null, style]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[StyleSheet.absoluteFill, {
        transform: [
          { translateX: derive.interpolate({ inputRange: [0, 1], outputRange: [-10, 10] }) },
          { translateY: derive.interpolate({ inputRange: [0, 1], outputRange: [4, -6] }) },
          { scale: derive.interpolate({ inputRange: [0, 1], outputRange: [1.06, 1.12] }) },
        ],
      }]}>
        <Svg width="100%" height="100%" viewBox="0 0 800 520" preserveAspectRatio="xMidYMid slice">
          <Defs>
            <LinearGradient id={idFond} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={fondu ?? c.fond[0]} /><Stop offset="1" stopColor={fondu ?? c.fond[1]} />
            </LinearGradient>
            {fondu ? (
              <LinearGradient id={idFondu} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={fondu} stopOpacity={1} /><Stop offset="0.52" stopColor={fondu} stopOpacity={0} />
              </LinearGradient>
            ) : null}
          </Defs>
          <Rect x="0" y="0" width="800" height="520" fill={`url(#${idFond})`} />
          <Polygon points={sol} fill={c.rue} />
          {blocs.map(({ i, j, h }) => {
            const x = i * CELLULE + MARGE; const y = j * CELLULE + MARGE; const t = CELLULE - 2 * MARGE;
            return <Polygon key={`s${i}-${j}`} points={poly([projeter(x, y), projeter(x + t, y), projeter(x + t, y + t), projeter(x, y + t)])} fill={h ? c.sol : c.place} />;
          })}
          {blocs.filter((b) => b.h > 0).map(({ i, j, h }) => {
            const x = i * CELLULE + MARGE; const y = j * CELLULE + MARGE; const t = CELLULE - 2 * MARGE; const z = h * elevation;
            return (
              <G key={`b${i}-${j}`}>
                <Polygon points={poly([projeter(x, y + t), projeter(x + t, y + t), projeter(x + t, y + t, z), projeter(x, y + t, z)])} fill={c.gauche} />
                <Polygon points={poly([projeter(x + t, y), projeter(x + t, y + t), projeter(x + t, y + t, z), projeter(x + t, y, z)])} fill={c.droite} />
                <Polygon points={poly([projeter(x, y, z), projeter(x + t, y, z), projeter(x + t, y + t, z), projeter(x, y + t, z)])} fill={c.haut} stroke={c.arete} strokeWidth={1} />
              </G>
            );
          })}
          {/* Itineraire par-dessus les immeubles : il reste lisible meme dans un quartier dense */}
          <Path d={trace} stroke="rgba(242,178,51,0.25)" strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          {SVG_ANIME ? (
            <AnimatedPath d={trace} stroke="#F2B233" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" fill="none"
              strokeDasharray="16 11" strokeDashoffset={defile.interpolate({ inputRange: [0, 1], outputRange: [0, -27] })} />
          ) : (
            <Path d={trace} stroke="#F2B233" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray="16 11" />
          )}
          <Repere x={dx} y={dy} couleur="#F2B233" centre="#15171A" />
          <Repere x={ax} y={ay} couleur="#15171A" centre="#F2B233" bord="#F2B233" />
          {SVG_ANIME ? (
            <AnimatedCircle cx={px} cy={py} fill="none" stroke="#F2B233" strokeWidth={3}
              r={onde.interpolate({ inputRange: [0, 1], outputRange: [10, 34] })} opacity={onde.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] })} />
          ) : <Circle cx={px} cy={py} r={24} fill="none" stroke="rgba(242,178,51,0.4)" strokeWidth={3} />}
          <Circle cx={px} cy={py} r={12} fill="#F2B233" stroke="#15171A" strokeWidth={4} />
          {fondu ? <Rect x="0" y="0" width="800" height="520" fill={`url(#${idFondu})`} /> : null}
        </Svg>
      </Animated.View>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'transparent' }]} />
    </View>
  );
}

function Repere({ x, y, couleur, centre, bord }: { x: number; y: number; couleur: string; centre: string; bord?: string }) {
  // Goutte : cercle et pointe vers le bas, ancree sur le point de la carte
  const d = `M${x} ${y} C${x - 6} ${y - 14} ${x - 16} ${y - 20} ${x - 16} ${y - 32} A16 16 0 1 1 ${x + 16} ${y - 32} C${x + 16} ${y - 20} ${x + 6} ${y - 14} ${x} ${y} Z`;
  return (
    <G>
      <Path d={d} fill={couleur} stroke={bord ?? 'none'} strokeWidth={bord ? 3 : 0} />
      <Circle cx={x} cy={y - 32} r={6} fill={centre} />
    </G>
  );
}

/** Point de l'itineraire a la fraction p de sa longueur. */
function pointSurTrajet(p: number): [number, number] {
  const segments = TRAJET.slice(1).map((b, k) => { const a = TRAJET[k]; return { a, b, l: Math.hypot(b[0] - a[0], b[1] - a[1]) }; });
  const total = segments.reduce((s, x) => s + x.l, 0);
  let reste = Math.max(0, Math.min(1, p)) * total;
  for (const s of segments) {
    if (reste <= s.l) { const f = s.l ? reste / s.l : 0; return [s.a[0] + (s.b[0] - s.a[0]) * f, s.a[1] + (s.b[1] - s.a[1]) * f]; }
    reste -= s.l;
  }
  return TRAJET[TRAJET.length - 1];
}

/** Frise de trajet (reference « Ride complete ») : heures, duree, piste avec disque ambre qui avance. */
export function FriseTrajet({ depart, arrivee, duree, de, vers, distance, progression = 0.5, icone }: {
  depart: string; arrivee: string; duree: string; de: string; vers: string; distance: string; progression?: number; icone?: ReactNode;
}) {
  const p = Math.max(0, Math.min(1, progression));
  const avance = useState(() => new Animated.Value(0))[0];
  const [largeur, setLargeur] = useState(0);
  useEffect(() => {
    Animated.timing(avance, { toValue: p, duration: 1400, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [p, avance]);
  return (
    <View style={styles.frise}>
      <View style={styles.friseLigne}>
        <Text style={styles.friseHeure}>{depart}</Text>
        <Text style={styles.friseDuree}>{duree}</Text>
        <Text style={styles.friseHeure}>{arrivee}</Text>
      </View>
      <View style={styles.piste} onLayout={(e) => setLargeur(e.nativeEvent.layout.width)}>
        <View style={styles.pisteFond} />
        <Animated.View style={[styles.pisteRempli, { width: avance.interpolate({ inputRange: [0, 1], outputRange: [0, Math.max(0, largeur - 8)] }) }]} />
        <View style={[styles.point, { left: 0 }]} />
        <View style={[styles.point, { right: 0 }]} />
        <Animated.View style={[styles.disque, { transform: [{ translateX: avance.interpolate({ inputRange: [0, 1], outputRange: [0, Math.max(0, largeur - 36)] }) }] }]}>
          {icone}
        </Animated.View>
      </View>
      <View style={styles.friseLigne}>
        <Text style={styles.friseLieu} numberOfLines={1}>{de}</Text>
        <Text style={styles.friseDistance}>{distance}</Text>
        <Text style={[styles.friseLieu, { textAlign: 'right' }]} numberOfLines={1}>{vers}</Text>
      </View>
    </View>
  );
}

/** Pastille d'etat avec point (pulsant pour un etat en cours). */
export function Pilule({ texte, ton = 'accent', pulse = false }: { texte: string; ton?: 'accent' | 'succes' | 'danger' | 'neutre' | 'verre' | 'nuit'; pulse?: boolean }) {
  const o = useState(() => new Animated.Value(1))[0];
  useEffect(() => {
    if (!pulse) return;
    const b = Animated.loop(Animated.sequence([
      Animated.timing(o, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      Animated.timing(o, { toValue: 1, duration: 800, useNativeDriver: true }),
    ]));
    b.start();
    return () => b.stop();
  }, [pulse, o]);
  const t = PILULES[ton];
  return (
    <View style={[styles.pilule, { backgroundColor: t.fond, borderColor: t.bord ?? 'transparent' }]}>
      <Animated.View style={[styles.piluleRond, { backgroundColor: t.point ?? t.texte, opacity: o }]} />
      <Text style={[styles.piluleTexte, { color: t.texte }]}>{texte}</Text>
    </View>
  );
}
const PILULES: Record<string, { fond: string; texte: string; point?: string; bord?: string }> = {
  accent: { fond: '#FDF3DC', texte: '#7A4D00' },
  succes: { fond: '#E3F4EC', texte: '#1F6F43' },
  danger: { fond: '#FBE9E7', texte: '#C8312B' },
  neutre: { fond: '#ECEBE7', texte: '#6B6F76' },
  verre: { fond: 'rgba(27,28,31,0.6)', texte: '#F4F3EF', point: '#F2B233', bord: 'rgba(255,255,255,0.12)' },
  nuit: { fond: '#1B1C1F', texte: '#F4F3EF', point: '#F2B233' },
};

const styles = StyleSheet.create({
  cadre: { overflow: 'hidden', backgroundColor: '#1B1C1F' },
  bandeau: { minHeight: 210, borderRadius: 28, backgroundColor: '#1B1C1F', overflow: 'hidden', padding: 20, justifyContent: 'space-between', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  bandeauVille: { position: 'absolute', top: 0, bottom: 0, left: '34%', right: 0 },
  bandeauHaut: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 18 },
  bandeauSurtitre: { color: '#9A9EA6', fontSize: 12, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
  bandeauTitre: { color: '#FFFFFF', fontSize: 34, fontWeight: '800', letterSpacing: -1.1, lineHeight: 38, maxWidth: '78%' },
  bandeauValeur: { color: '#F2B233', fontSize: 40, fontWeight: '800', letterSpacing: -1.2, marginTop: 6, fontVariant: ['tabular-nums'] },
  bandeauNote: { color: '#C9CCD2', fontSize: 14, marginTop: 4, maxWidth: '80%' },
  frise: { gap: 14 },
  friseLigne: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  friseHeure: { color: '#9A9EA6', fontSize: 14, fontVariant: ['tabular-nums'] },
  friseDuree: { color: '#F4F3EF', fontSize: 17, fontWeight: '700' },
  friseLieu: { flex: 1, color: '#F4F3EF', fontSize: 15, fontWeight: '600' },
  friseDistance: { color: '#F4F3EF', fontSize: 13, fontWeight: '700', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  piste: { height: 36, justifyContent: 'center' },
  pisteFond: { position: 'absolute', left: 4, right: 4, height: 2, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.14)' },
  pisteRempli: { position: 'absolute', left: 4, height: 2, borderRadius: 2, backgroundColor: '#F2B233' },
  point: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: '#F2B233' },
  disque: { position: 'absolute', left: 0, width: 36, height: 36, borderRadius: 18, backgroundColor: '#F2B233', alignItems: 'center', justifyContent: 'center', borderWidth: 6, borderColor: 'rgba(242,178,51,0.25)' },
  pilule: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', paddingVertical: 5, paddingLeft: 10, paddingRight: 12, borderRadius: 999, borderWidth: 1 },
  piluleRond: { width: 7, height: 7, borderRadius: 4 },
  piluleTexte: { fontSize: 12, fontWeight: '700' },
});

/**
 * Bandeau nuit avec la ville 3D qui se fond par la gauche : surtitre, grand titre, valeur vedette en ambre.
 * Sert d'en-tete commun aux ecrans des trois applications.
 */
export function BandeauVille({ surtitre, titre, valeur, note, pastille, progression = 0.55, enfants, style }: {
  surtitre?: string;
  titre: string;
  /** Chiffre vedette affiche en ambre sous le titre (montant, compteur). */
  valeur?: string;
  note?: string;
  pastille?: ReactNode;
  progression?: number;
  enfants?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.bandeau, style]}>
      <Ville3D ton="nuit" fondu="#1B1C1F" progression={progression} style={styles.bandeauVille} />
      <View style={styles.bandeauHaut}>
        {surtitre ? <Text style={styles.bandeauSurtitre}>{surtitre}</Text> : <View />}
        {pastille}
      </View>
      <View>
        <Text accessibilityRole="header" style={styles.bandeauTitre}>{titre}</Text>
        {valeur ? <Text style={styles.bandeauValeur} adjustsFontSizeToFit numberOfLines={1}>{valeur}</Text> : null}
        {note ? <Text style={styles.bandeauNote}>{note}</Text> : null}
        {enfants}
      </View>
    </View>
  );
}
