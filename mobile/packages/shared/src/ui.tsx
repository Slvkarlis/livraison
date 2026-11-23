import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { STATUTS } from './format';
import type { StatutLivraison } from './types';

/** Identite visuelle d'une application : chaque app fournit la sienne. */
export interface Theme {
  sombre: boolean;
  fond: string;
  surface: string;
  surfaceAlt: string;
  texte: string;
  secondaire: string;
  bordure: string;
  accent: string;
  surAccent: string;
  accentDoux: string;
  erreur: string;
  erreurFond: string;
  succes: string;
  rayon: number;
  /** Ombre des cartes (theme clair) ou simple bordure (theme sombre). */
  ombre: boolean;
}

export const themeParDefaut: Theme = {
  sombre: false,
  // Direction « ambre et graphite » (tokens Doop, canvas FleetPulse, inspiree de la photo de reference).
  fond: '#ECEBE7',
  surface: '#FFFFFF',
  surfaceAlt: '#F6F5F2',
  texte: '#15171A',
  secondaire: '#6B6F76',
  bordure: '#DADAD5',
  accent: '#F2B233',
  surAccent: '#15171A',
  accentDoux: '#FDF3DC',
  erreur: '#C8312B',
  erreurFond: '#FBE9E7',
  succes: '#7A4D00',
  rayon: 16,
  ombre: true,
};

const ThemeContext = createContext<Theme>(themeParDefaut);

export function ThemeProvider({ theme, children }: { theme: Theme; children: ReactNode }) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/** Styles recalcules uniquement quand le theme change. */
export function useStyles<T extends Record<string, object>>(fabrique: (theme: Theme) => T): T {
  const theme = useTheme();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => StyleSheet.create(fabrique(theme)), [theme]);
}

export function Titre({ children, sousTitre }: { children: ReactNode; sousTitre?: string }) {
  const s = useStyles(fabriqueStyles);
  return (
    <View style={s.titreBloc}>
      <Text style={s.titre}>{children}</Text>
      {sousTitre ? <Text style={s.sousTitre}>{sousTitre}</Text> : null}
    </View>
  );
}

export function Carte({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const s = useStyles(fabriqueStyles);
  return <View style={[s.carte, style]}>{children}</View>;
}

export function Ligne({ libelle, valeur, fort }: { libelle: string; valeur: ReactNode; fort?: boolean }) {
  const s = useStyles(fabriqueStyles);
  return (
    <View style={s.ligne}>
      <Text style={[s.ligneLibelle, fort && s.ligneForte]}>{libelle}</Text>
      <Text style={[s.ligneValeur, fort && s.ligneForte]}>{valeur}</Text>
    </View>
  );
}

type Variante = 'primaire' | 'secondaire' | 'discret' | 'danger';

export function Bouton({
  titre,
  onPress,
  variante = 'primaire',
  chargement = false,
  desactive = false,
  icone,
  style,
}: {
  titre: string;
  onPress: () => void;
  variante?: Variante;
  chargement?: boolean;
  desactive?: boolean;
  icone?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const s = useStyles(fabriqueStyles);
  const inactif = desactive || chargement;
  const fond = variante === 'primaire' ? theme.accent : variante === 'secondaire' ? theme.surfaceAlt : 'transparent';
  const couleurTexte = variante === 'primaire' ? theme.surAccent
    : variante === 'secondaire' ? theme.texte
    : variante === 'danger' ? theme.erreur : theme.accent;
  const [echelle] = useState(() => new Animated.Value(1));
  // La mise en page (marges, flex, largeur) va a la zone tactile ; l'apparence (bord, fond) au bouton dessine
  const { disposition, apparence } = separerStyle(style);
  const presser = (vers: number) => Animated.spring(echelle, { toValue: vers, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactif }}
      onPress={onPress}
      disabled={inactif}
      onPressIn={() => presser(0.97)}
      onPressOut={() => presser(1)}
      style={disposition}
    >
      {({ pressed }) => (
        <Animated.View style={[
          s.bouton,
          variante === 'primaire' && s.boutonPrimaire,
          variante === 'secondaire' && s.boutonSecondaire,
          { backgroundColor: fond, opacity: inactif ? 0.45 : pressed ? 0.9 : 1, transform: [{ scale: echelle }] },
          apparence,
        ]}>
          {chargement ? (
            <ActivityIndicator color={couleurTexte} />
          ) : (
            <View style={s.boutonContenu}>
              {icone}
              <Text style={[s.boutonTexte, { color: couleurTexte }]}>{titre}</Text>
            </View>
          )}
        </Animated.View>
      )}
    </Pressable>
  );
}

const CLES_DISPOSITION = new Set(['flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf', 'width', 'minWidth', 'maxWidth',
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical', 'position', 'top', 'bottom', 'left', 'right']);
function separerStyle(style: StyleProp<ViewStyle>): { disposition: ViewStyle; apparence: ViewStyle } {
  const plat = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  const disposition: Record<string, unknown> = {}; const apparence: Record<string, unknown> = {};
  for (const [cle, valeur] of Object.entries(plat)) (CLES_DISPOSITION.has(cle) ? disposition : apparence)[cle] = valeur;
  return { disposition: disposition as ViewStyle, apparence: apparence as ViewStyle };
}

export function Champ({ libelle, erreur, ...props }: TextInputProps & { libelle: string; erreur?: string }) {
  const theme = useTheme();
  const s = useStyles(fabriqueStyles);
  const [focus, setFocus] = useState(false);
  return (
    <View style={s.champBloc}>
      <Text style={s.champLibelle}>{libelle}</Text>
      <TextInput
        accessibilityLabel={libelle}
        placeholderTextColor={theme.secondaire}
        selectionColor={theme.accent}
        keyboardAppearance={theme.sombre ? 'dark' : 'light'}
        {...props}
        onFocus={(e) => { setFocus(true); props.onFocus?.(e); }}
        onBlur={(e) => { setFocus(false); props.onBlur?.(e); }}
        style={[
          s.champ,
          { borderColor: erreur ? theme.erreur : focus ? theme.accent : theme.bordure },
          focus && !erreur ? s.champFocus : null,
          props.style,
        ]}
      />
      {erreur ? <Text style={s.champErreur}>{erreur}</Text> : null}
    </View>
  );
}

export function MessageErreur({ message }: { message: string | null }) {
  const s = useStyles(fabriqueStyles);
  if (!message) return null;
  return (
    <View style={s.erreurBloc} accessibilityRole="alert">
      <Text style={s.erreurTexte}>{message}</Text>
    </View>
  );
}

/** libelle : remplace le libelle client (ex. vue partenaire, voir libelleStatutPartenaire). */
export function PastilleStatut({ statut, libelle: remplacement }: { statut: StatutLivraison; libelle?: string }) {
  const s = useStyles(fabriqueStyles);
  const { couleur, fond } = STATUTS[statut];
  const libelle = remplacement ?? STATUTS[statut].libelle;
  return (
    <View style={[s.pastille, { backgroundColor: fond }]}>
      <View style={[s.pastillePoint, { backgroundColor: couleur }]} />
      <Text style={[s.pastilleTexte, { color: couleur }]}>{libelle}</Text>
    </View>
  );
}

export function EtatVide({ titre, texte, action }: { titre: string; texte: string; action?: ReactNode }) {
  const s = useStyles(fabriqueStyles);
  return (
    <View style={s.vide}>
      <Text style={s.videTitre}>{titre}</Text>
      <Text style={s.videTexte}>{texte}</Text>
      {action}
    </View>
  );
}

export function Chargement() {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.fond }}>
      <ActivityIndicator size="large" color={theme.accent} />
    </View>
  );
}

function fabriqueStyles(t: Theme) {
  return {
    titreBloc: { marginBottom: 20 },
    titre: { fontSize: 28, fontWeight: '800', color: t.texte, letterSpacing: -0.8, lineHeight: 32 },
    sousTitre: { marginTop: 4, fontSize: 15, color: t.secondaire },
    carte: {
      backgroundColor: t.surface,
      borderRadius: 24,
      padding: 18,
      ...(t.ombre
        ? { shadowColor: '#1E1B4B', shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 2 }
        : { borderWidth: 1, borderColor: t.bordure }),
    },
    ligne: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, gap: 12 },
    ligneLibelle: { fontSize: 15, color: t.secondaire, flex: 1 },
    ligneValeur: { fontSize: 15, color: t.texte, fontWeight: '600', flexShrink: 1, maxWidth: '60%', textAlign: 'right', fontVariant: ['tabular-nums'] },
    ligneForte: { fontSize: 17, fontWeight: '700', color: t.texte },
    bouton: {
      minHeight: 54,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 22,
    },
    boutonPrimaire: { shadowColor: t.accent, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
    boutonSecondaire: { borderWidth: 1, borderColor: t.bordure },
    boutonContenu: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    boutonTexte: { fontSize: 16, fontWeight: '700', letterSpacing: 0.1, textAlign: 'center', flexShrink: 1 },
    champBloc: { marginBottom: 16 },
    champLibelle: { fontSize: 14, fontWeight: '500', color: t.texte, marginBottom: 6 },
    champ: {
      minHeight: 54,
      borderWidth: 1,
      borderRadius: 16,
      paddingHorizontal: 16,
      fontSize: 16,
      color: t.texte,
      backgroundColor: t.surfaceAlt,
    },
    champFocus: { shadowColor: t.accent, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
    champErreur: { marginTop: 4, fontSize: 13, color: t.erreur },
    erreurBloc: { backgroundColor: t.erreurFond, borderRadius: 16, padding: 14, marginBottom: 16 },
    erreurTexte: { color: t.erreur, fontSize: 14, lineHeight: 20 },
    pastille: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    pastillePoint: { width: 6, height: 6, borderRadius: 3 },
    pastilleTexte: { fontSize: 13, fontWeight: '600' },
    vide: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24, gap: 8 },
    videTitre: { fontSize: 18, fontWeight: '600', color: t.texte, textAlign: 'center' },
    videTexte: { fontSize: 15, color: t.secondaire, textAlign: 'center', marginBottom: 12, lineHeight: 21 },
  } as const;
}

/** Affiche quand la session enregistree ne peut pas etre verifiee (backend eteint, pare-feu, autre Wi-Fi). */
export function EcranServeurInjoignable({ message, onReessayer, onDeconnexion }: {
  message: string;
  onReessayer: () => void;
  onDeconnexion: () => void;
}) {
  const theme = useTheme();
  const s = useStyles(fabriqueStyles);
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: theme.fond }}>
      <Text style={s.titre}>Serveur injoignable</Text>
      <Text style={[s.sousTitre, { marginBottom: 20, lineHeight: 21 }]}>{message}</Text>
      <Bouton titre="Réessayer" onPress={onReessayer} />
      <Bouton titre="Se déconnecter" variante="discret" onPress={onDeconnexion} style={{ marginTop: 8 }} />
    </View>
  );
}

/** Ionicons n'accepte qu'une string : conversion securisee de la couleur fournie par la barre d'onglets. */
export function couleurIcone(color: unknown): string | undefined {
  if (typeof color === 'string') return color;
  if (typeof color === 'number') return `#${color.toString(16).padStart(8, '0')}`;
  return undefined;
}
