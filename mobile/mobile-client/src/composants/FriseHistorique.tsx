import { Carte, ROLES_ACTEUR, STATUTS, formatHeure, formatJour, type HistoriqueEntree } from '@fleetpulse/shared';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

/** Frise des etapes d'une commande (HistoriqueStatut) ; libelle : formulation client ou partenaire. */
export function FriseHistorique({ etapes, libelle, auteurs = true }: {
  etapes: HistoriqueEntree[];
  libelle: (etape: HistoriqueEntree) => string;
  /** false : masque l'auteur de chaque etape (vue client). */
  auteurs?: boolean;
}) {
  if (!etapes.length) return null;
  return (
    <Carte>
      {etapes.map((h, index) => {
        const date = new Date(h.date);
        const dernier = index === etapes.length - 1;
        return (
          <View key={`${h.date}-${index}`} style={styles.etape}>
            <View style={styles.repere}>
              <View style={[styles.point, { backgroundColor: STATUTS[h.nouveau].couleur }]} />
              {!dernier ? <View style={styles.trait} /> : null}
            </View>
            <View style={styles.etapeCorps}>
              <Text style={styles.etapeTitre}>{libelle(h)}</Text>
              <Text style={styles.etapeMeta}>
                {formatJour(date)} à {formatHeure(date)}{auteurs ? ` · ${ROLES_ACTEUR[h.acteurRole]}` : ''}
              </Text>
              {h.motif ? <Text style={styles.etapeMotif}>{h.motif}</Text> : null}
            </View>
          </View>
        );
      })}
    </Carte>
  );
}

const styles = StyleSheet.create({
  etape: { flexDirection: 'row', gap: 12 },
  repere: { alignItems: 'center', width: 14 },
  point: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  trait: { flex: 1, width: 2, backgroundColor: theme.bordure, marginVertical: 2 },
  etapeCorps: { flex: 1, paddingBottom: 14 },
  etapeTitre: { fontSize: 15, fontWeight: '600', color: theme.texte },
  etapeMeta: { fontSize: 13, color: theme.secondaire, marginTop: 2 },
  etapeMotif: { fontSize: 14, color: theme.texte, marginTop: 4 },
});
