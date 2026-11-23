import { MessageErreur, api, type TypeReclamation } from '@fleetpulse/shared';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '../theme';

const TYPES: { valeur: TypeReclamation; libelle: string }[] = [
  { valeur: 'QUALITE', libelle: 'Qualité' },
  { valeur: 'MANQUANT', libelle: 'Article manquant' },
  { valeur: 'RETARD', libelle: 'Retard' },
  { valeur: 'AUTRE', libelle: 'Autre' },
];

/** US-516 : le client signale un problème sur une commande livrée, dans les 48 h. */
export function ReclamationClient({ commandeId, totalDt, onEnvoyee }: { commandeId: number; totalDt: number; onEnvoyee: () => void }) {
  const [type, setType] = useState<TypeReclamation>('QUALITE');
  const [description, setDescription] = useState('');
  const [montant, setMontant] = useState(String(totalDt));
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [fait, setFait] = useState(false);

  async function envoyer() {
    const m = Number(montant.replace(',', '.'));
    if (description.trim().length < 10) { setErreur('Décrivez le problème en 10 caractères au moins.'); return; }
    if (!Number.isFinite(m) || m < 0 || m > totalDt) { setErreur(`Montant demandé : entre 0 et ${totalDt} DT.`); return; }
    setEnvoi(true);
    setErreur(null);
    try {
      await api.ouvrirReclamation(commandeId, type, description.trim(), m);
      setFait(true);
      onEnvoyee();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Envoi impossible.');
    } finally {
      setEnvoi(false);
    }
  }

  if (fait) return <Text style={styles.merci}>Votre réclamation est enregistrée. Nous vous répondrons rapidement.</Text>;

  return (
    <View style={styles.carte}>
      <Text style={styles.titre}>Un problème avec cette commande ?</Text>
      <View style={styles.types}>
        {TYPES.map((t) => (
          <Pressable key={t.valeur} onPress={() => setType(t.valeur)} style={[styles.type, type === t.valeur && styles.typeActif]} accessibilityRole="radio" accessibilityState={{ selected: type === t.valeur }}>
            <Text style={[styles.typeTexte, type === t.valeur && { color: theme.texte }]}>{t.libelle}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput style={styles.saisie} placeholder="Décrivez ce qui s’est passé" placeholderTextColor={theme.secondaire} value={description} onChangeText={setDescription} multiline maxLength={500} editable={!envoi} />
      <TextInput style={styles.saisieCourte} placeholder={`Montant demandé (max ${totalDt} DT)`} placeholderTextColor={theme.secondaire} value={montant} onChangeText={setMontant} keyboardType="decimal-pad" editable={!envoi} />
      <MessageErreur message={erreur} />
      <Pressable onPress={() => void envoyer()} disabled={envoi} style={({ pressed }) => [styles.bouton, pressed && { opacity: 0.9 }]}>
        <Text style={styles.boutonTexte}>{envoi ? 'Envoi…' : 'Envoyer la réclamation'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { backgroundColor: theme.surface, borderRadius: theme.rayon + 4, padding: 18, marginTop: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  titre: { fontSize: 17, fontWeight: '800', color: theme.texte, marginBottom: 12 },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  type: { borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: theme.surfaceAlt, borderWidth: 1, borderColor: 'transparent' },
  typeActif: { backgroundColor: theme.accentDoux, borderColor: theme.accent },
  typeTexte: { color: theme.secondaire, fontWeight: '700', fontSize: 13 },
  saisie: { borderWidth: 1, borderColor: theme.bordure, borderRadius: theme.rayon, padding: 12, minHeight: 80, color: theme.texte, textAlignVertical: 'top' },
  saisieCourte: { borderWidth: 1, borderColor: theme.bordure, borderRadius: theme.rayon, padding: 12, marginTop: 10, color: theme.texte },
  bouton: { marginTop: 14, backgroundColor: theme.accent, borderRadius: theme.rayon, paddingVertical: 14, alignItems: 'center' },
  boutonTexte: { color: theme.surAccent, fontWeight: '800', fontSize: 15 },
  merci: { color: theme.succes, fontWeight: '700', marginTop: 16 },
});
