import { createContext, useContext, useState, type ReactNode } from 'react';
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

export const couleurs = {
  fond: '#FFFFFF',
  surface: '#F6F7F9',
  texte: '#111827',
  secondaire: '#6B7280',
  bordure: '#E5E7EB',
  erreur: '#B91C1C',
  erreurFond: '#FEF2F2',
};

const AccentContext = createContext('#4F46E5');

/** Chaque application choisit une seule couleur d'accent. */
export function AccentProvider({ couleur, children }: { couleur: string; children: ReactNode }) {
  return <AccentContext.Provider value={couleur}>{children}</AccentContext.Provider>;
}

export function useAccent() {
  return useContext(AccentContext);
}

export function Titre({ children, sousTitre }: { children: ReactNode; sousTitre?: string }) {
  return (
    <View style={styles.titreBloc}>
      <Text style={styles.titre}>{children}</Text>
      {sousTitre ? <Text style={styles.sousTitre}>{sousTitre}</Text> : null}
    </View>
  );
}

export function Carte({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.carte, style]}>{children}</View>;
}

export function Ligne({ libelle, valeur }: { libelle: string; valeur: ReactNode }) {
  return (
    <View style={styles.ligne}>
      <Text style={styles.ligneLibelle}>{libelle}</Text>
      <Text style={styles.ligneValeur}>{valeur}</Text>
    </View>
  );
}

type Variante = 'primaire' | 'secondaire' | 'discret';

export function Bouton({
  titre,
  onPress,
  variante = 'primaire',
  chargement = false,
  desactive = false,
  style,
}: {
  titre: string;
  onPress: () => void;
  variante?: Variante;
  chargement?: boolean;
  desactive?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const accent = useAccent();
  const inactif = desactive || chargement;
  const fond = variante === 'primaire' ? accent : variante === 'secondaire' ? couleurs.surface : 'transparent';
  const couleurTexte = variante === 'primaire' ? '#FFFFFF' : variante === 'secondaire' ? couleurs.texte : accent;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={inactif}
      style={({ pressed }) => [
        styles.bouton,
        { backgroundColor: fond, opacity: inactif ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {chargement ? (
        <ActivityIndicator color={couleurTexte} />
      ) : (
        <Text style={[styles.boutonTexte, { color: couleurTexte }]}>{titre}</Text>
      )}
    </Pressable>
  );
}

export function Champ({ libelle, erreur, ...props }: TextInputProps & { libelle: string; erreur?: string }) {
  const accent = useAccent();
  const [focus, setFocus] = useState(false);
  return (
    <View style={styles.champBloc}>
      <Text style={styles.champLibelle}>{libelle}</Text>
      <TextInput
        placeholderTextColor="#9CA3AF"
        {...props}
        onFocus={(e) => { setFocus(true); props.onFocus?.(e); }}
        onBlur={(e) => { setFocus(false); props.onBlur?.(e); }}
        style={[
          styles.champ,
          { borderColor: erreur ? couleurs.erreur : focus ? accent : couleurs.bordure },
          props.style,
        ]}
      />
      {erreur ? <Text style={styles.champErreur}>{erreur}</Text> : null}
    </View>
  );
}

export function MessageErreur({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.erreurBloc}>
      <Text style={styles.erreurTexte}>{message}</Text>
    </View>
  );
}

export function PastilleStatut({ statut }: { statut: StatutLivraison }) {
  const { libelle, couleur, fond } = STATUTS[statut];
  return (
    <View style={[styles.pastille, { backgroundColor: fond }]}>
      <Text style={[styles.pastilleTexte, { color: couleur }]}>{libelle}</Text>
    </View>
  );
}

export function EtatVide({ titre, texte, action }: { titre: string; texte: string; action?: ReactNode }) {
  return (
    <View style={styles.vide}>
      <Text style={styles.videTitre}>{titre}</Text>
      <Text style={styles.videTexte}>{texte}</Text>
      {action}
    </View>
  );
}

export function Chargement() {
  const accent = useAccent();
  return (
    <View style={styles.chargement}>
      <ActivityIndicator size="large" color={accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  titreBloc: { marginBottom: 20 },
  titre: { fontSize: 28, fontWeight: '700', color: couleurs.texte, letterSpacing: -0.5 },
  sousTitre: { marginTop: 4, fontSize: 15, color: couleurs.secondaire },
  carte: {
    backgroundColor: couleurs.fond,
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: couleurs.bordure,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  ligne: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, gap: 12 },
  ligneLibelle: { fontSize: 15, color: couleurs.secondaire },
  ligneValeur: { fontSize: 15, color: couleurs.texte, fontWeight: '500', flexShrink: 1, textAlign: 'right' },
  bouton: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  boutonTexte: { fontSize: 16, fontWeight: '600' },
  champBloc: { marginBottom: 16 },
  champLibelle: { fontSize: 14, fontWeight: '500', color: couleurs.texte, marginBottom: 6 },
  champ: {
    height: 50,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: couleurs.texte,
    backgroundColor: couleurs.fond,
  },
  champErreur: { marginTop: 4, fontSize: 13, color: couleurs.erreur },
  erreurBloc: { backgroundColor: couleurs.erreurFond, borderRadius: 12, padding: 12, marginBottom: 16 },
  erreurTexte: { color: couleurs.erreur, fontSize: 14 },
  pastille: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pastilleTexte: { fontSize: 13, fontWeight: '600' },
  vide: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24, gap: 8 },
  videTitre: { fontSize: 18, fontWeight: '600', color: couleurs.texte, textAlign: 'center' },
  videTexte: { fontSize: 15, color: couleurs.secondaire, textAlign: 'center', marginBottom: 12 },
  chargement: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: couleurs.fond },
});
