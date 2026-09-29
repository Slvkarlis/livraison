import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
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
  fond: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F3F4F6',
  texte: '#111827',
  secondaire: '#6B7280',
  bordure: '#E5E7EB',
  accent: '#4F46E5',
  surAccent: '#FFFFFF',
  accentDoux: '#EEF2FF',
  erreur: '#B91C1C',
  erreurFond: '#FEF2F2',
  succes: '#15803D',
  rayon: 14,
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
export function useStyles<T extends StyleSheet.NamedStyles<T>>(fabrique: (theme: Theme) => T): T {
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactif }}
      onPress={onPress}
      disabled={inactif}
      style={({ pressed }) => [
        s.bouton,
        { backgroundColor: fond, opacity: inactif ? 0.45 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {chargement ? (
        <ActivityIndicator color={couleurTexte} />
      ) : (
        <View style={s.boutonContenu}>
          {icone}
          <Text style={[s.boutonTexte, { color: couleurTexte }]}>{titre}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Champ({ libelle, erreur, ...props }: TextInputProps & { libelle: string; erreur?: string }) {
  const theme = useTheme();
  const s = useStyles(fabriqueStyles);
  const [focus, setFocus] = useState(false);
  return (
    <View style={s.champBloc}>
      <Text style={s.champLibelle}>{libelle}</Text>
      <TextInput
        placeholderTextColor={theme.secondaire}
        selectionColor={theme.accent}
        keyboardAppearance={theme.sombre ? 'dark' : 'light'}
        {...props}
        onFocus={(e) => { setFocus(true); props.onFocus?.(e); }}
        onBlur={(e) => { setFocus(false); props.onBlur?.(e); }}
        style={[
          s.champ,
          { borderColor: erreur ? theme.erreur : focus ? theme.accent : theme.bordure },
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

export function PastilleStatut({ statut }: { statut: StatutLivraison }) {
  const s = useStyles(fabriqueStyles);
  const { libelle, couleur } = STATUTS[statut];
  return (
    <View style={[s.pastille, { backgroundColor: couleur + '1F' }]}>
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
    titre: { fontSize: 28, fontWeight: '700', color: t.texte, letterSpacing: -0.5 },
    sousTitre: { marginTop: 4, fontSize: 15, color: t.secondaire },
    carte: {
      backgroundColor: t.surface,
      borderRadius: t.rayon,
      padding: 16,
      ...(t.ombre
        ? { shadowColor: '#1E1B4B', shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 2 }
        : { borderWidth: 1, borderColor: t.bordure }),
    },
    ligne: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, gap: 12 },
    ligneLibelle: { fontSize: 15, color: t.secondaire },
    ligneValeur: { fontSize: 15, color: t.texte, fontWeight: '500', flexShrink: 1, textAlign: 'right' },
    ligneForte: { fontSize: 17, fontWeight: '700', color: t.texte },
    bouton: {
      minHeight: 54,
      borderRadius: Math.min(t.rayon, 16),
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
    boutonContenu: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    boutonTexte: { fontSize: 16, fontWeight: '600' },
    champBloc: { marginBottom: 16 },
    champLibelle: { fontSize: 14, fontWeight: '500', color: t.texte, marginBottom: 6 },
    champ: {
      minHeight: 52,
      borderWidth: 1,
      borderRadius: Math.min(t.rayon, 14),
      paddingHorizontal: 14,
      fontSize: 16,
      color: t.texte,
      backgroundColor: t.surfaceAlt,
    },
    champErreur: { marginTop: 4, fontSize: 13, color: t.erreur },
    erreurBloc: { backgroundColor: t.erreurFond, borderRadius: 12, padding: 12, marginBottom: 16 },
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
