import Ionicons from '@expo/vector-icons/Ionicons';
import { LIBELLES_MOTIF_ECHEC, MessageErreur, api, type MotifEchec } from '@fleetpulse/shared';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '../../theme';

/** US-308 : le coursier declare un echec de livraison avec un motif. Le responsable decide ensuite. */
export function DeclarerEchec({ missionId, onDeclare }: { missionId: number; onDeclare: () => void }) {
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState<MotifEchec | null>(null);
  const [commentaire, setCommentaire] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const motifs = Object.keys(LIBELLES_MOTIF_ECHEC) as MotifEchec[];

  async function envoyer() {
    if (!motif) { setErreur('Choisissez un motif.'); return; }
    if (motif === 'INCIDENT' && commentaire.trim().length < 5) { setErreur('Décrivez l’incident en 5 caractères au moins.'); return; }
    setEnvoi(true);
    setErreur(null);
    try {
      await api.declarerEchec(missionId, motif, commentaire.trim());
      setOuvert(false);
      onDeclare();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Envoi impossible.');
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <>
      <Pressable onPress={() => setOuvert(true)} style={({ pressed }) => [styles.declencheur, pressed && { opacity: 0.85 }]} accessibilityRole="button">
        <Ionicons name="alert-circle-outline" size={20} color={theme.erreur} />
        <Text style={styles.declencheurTexte}>Déclarer un échec</Text>
      </Pressable>
      <Modal visible={ouvert} animationType="slide" transparent onRequestClose={() => { if (!envoi) setOuvert(false); }}>
        <View style={styles.voile}>
          <View style={styles.feuille}>
            <Text style={styles.titre}>Pourquoi la livraison échoue-t-elle ?</Text>
            <ScrollView>
              {motifs.map((m) => (
                <Pressable key={m} onPress={() => setMotif(m)} style={[styles.ligne, motif === m && styles.ligneActive]} accessibilityRole="radio" accessibilityState={{ selected: motif === m }}>
                  <Text style={styles.ligneTexte}>{LIBELLES_MOTIF_ECHEC[m]}</Text>
                  {motif === m && <Ionicons name="checkmark-circle" size={20} color={theme.accent} />}
                </Pressable>
              ))}
              <TextInput
                style={styles.saisie}
                placeholder="Précisions (obligatoires pour un incident)"
                placeholderTextColor={theme.secondaire}
                value={commentaire}
                onChangeText={setCommentaire}
                multiline
                maxLength={500}
                editable={!envoi}
              />
              <MessageErreur message={erreur} />
            </ScrollView>
            <View style={styles.actions}>
              <Pressable onPress={() => setOuvert(false)} disabled={envoi} style={styles.secondaire}><Text style={styles.secondaireTexte}>Annuler</Text></Pressable>
              <Pressable onPress={() => void envoyer()} disabled={envoi} style={styles.principal}>
                <Text style={styles.principalTexte}>{envoi ? 'Envoi…' : 'Déclarer'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  declencheur: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: theme.rayon, borderWidth: 1, borderColor: theme.erreur, paddingVertical: 13, marginTop: 12 },
  declencheurTexte: { color: theme.erreur, fontWeight: '700', fontSize: 15 },
  voile: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  feuille: { backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, maxHeight: '85%' },
  titre: { fontSize: 20, fontWeight: '800', color: theme.texte, marginBottom: 14, letterSpacing: -0.4 },
  ligne: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: theme.rayon, padding: 14, marginBottom: 8, backgroundColor: theme.surfaceAlt },
  ligneActive: { backgroundColor: theme.accentDoux, borderWidth: 1, borderColor: theme.accent },
  ligneTexte: { color: theme.texte, fontSize: 15, fontWeight: '600' },
  saisie: { borderWidth: 1, borderColor: theme.bordure, borderRadius: theme.rayon, padding: 12, minHeight: 72, color: theme.texte, marginTop: 6, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  secondaire: { flex: 1, borderRadius: theme.rayon, padding: 15, alignItems: 'center', borderWidth: 1, borderColor: theme.bordure },
  secondaireTexte: { color: theme.texte, fontWeight: '700' },
  principal: { flex: 1, borderRadius: theme.rayon, padding: 15, alignItems: 'center', backgroundColor: theme.accent },
  principalTexte: { color: theme.surAccent, fontWeight: '800' },
});
