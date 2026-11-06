import {
  Bouton,
  LIBELLES_AFFECTATION,
  MessageErreur,
  api,
  useConfiguration,
  zonesEnVigueur,
  type Disponibilite,
  type Position,
} from '@fleetpulse/shared';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme';
import { POSITIONS_DEMO, positionActuelle } from '../position';

// US-2B8 : le coursier se declare disponible (depuis l'une de ses zones) ou indisponible
export function CarteDisponibilite({ disponibilite, onChange }: {
  disponibilite: Disponibilite;
  onChange: (maj: Disponibilite) => void;
}) {
  const { demonstration } = useConfiguration();
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const zones = zonesEnVigueur(disponibilite);

  async function executer(action: () => Promise<Disponibilite>) {
    setEnvoi(true);
    setErreur(null);
    try {
      onChange(await action());
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Action impossible.');
    } finally {
      setEnvoi(false);
    }
  }

  const devenirDisponible = (position?: Position) =>
    executer(async () => api.seDeclarerDisponible(position ?? await positionActuelle()));

  return (
    <View style={[styles.carte, disponibilite.disponible && styles.carteActive]}>
      <View style={styles.entete}>
        <View style={[styles.point, { backgroundColor: disponibilite.disponible ? theme.accent : theme.secondaire }]} />
        <Text style={styles.etat}>{disponibilite.disponible ? 'Disponible' : 'Indisponible'}</Text>
      </View>
      <Text style={styles.zones}>
        {zones.length
          ? zones.map((z) => `${LIBELLES_AFFECTATION[z.type]} : ${z.nom}`).join('\n')
          : 'Aucune zone affectée pour le moment. Contactez votre responsable.'}
      </Text>

      <MessageErreur message={erreur} />
      {disponibilite.disponible ? (
        <Bouton titre="Me déclarer indisponible" variante="secondaire" chargement={envoi}
          onPress={() => void executer(() => api.seDeclarerIndisponible())} />
      ) : (
        <Bouton titre="Je suis disponible" chargement={envoi} desactive={!zones.length} onPress={() => void devenirDisponible()} />
      )}

      {demonstration && !disponibilite.disponible && zones.length ? (
        <View style={styles.demo}>
          <Text style={styles.demoTitre}>Mode démonstration : position simulée</Text>
          <View style={styles.demoChoix}>
            {POSITIONS_DEMO.map((p) => (
              <Pressable key={p.libelle} accessibilityRole="button" disabled={envoi}
                onPress={() => void devenirDisponible(p.position)} style={styles.demoBouton}>
                <Text style={styles.demoTexte}>{p.libelle}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  carte: {
    gap: 12,
    padding: 16,
    borderRadius: theme.rayon,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.bordure,
  },
  carteActive: { borderColor: theme.accent },
  entete: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  point: { width: 10, height: 10, borderRadius: 5 },
  etat: { fontSize: 18, fontWeight: '800', color: theme.texte },
  zones: { fontSize: 14, color: theme.secondaire, lineHeight: 20 },
  demo: { gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.bordure },
  demoTitre: { fontSize: 12, fontWeight: '700', color: '#FBBF24', letterSpacing: 0.5 },
  demoChoix: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  demoBouton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: theme.bordure },
  demoTexte: { fontSize: 13, fontWeight: '600', color: theme.texte },
});
