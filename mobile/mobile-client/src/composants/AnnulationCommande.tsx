import Ionicons from '@expo/vector-icons/Ionicons';
import { Bouton, Champ, MOTIF_ANNULATION_MAX, MessageErreur, api } from '@fleetpulse/shared';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

// US-2B12 : le client annule sans frais une commande en attente ou acceptee (motif facultatif)
export function AnnulationCommande({ commandeId, onAnnulee }: { commandeId: number; onAnnulee: () => void }) {
  const [confirmation, setConfirmation] = useState(false);
  const [motif, setMotif] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function annuler() {
    setEnvoi(true);
    setErreur(null);
    try {
      await api.annulerCommande(commandeId, motif);
      onAnnulee();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Annulation impossible.');
    } finally {
      setEnvoi(false);
    }
  }

  if (!confirmation) {
    return (
      <Bouton
        titre="Annuler la commande"
        variante="danger"
        onPress={() => setConfirmation(true)}
        icone={<Ionicons name="close-circle-outline" size={20} color={theme.erreur} />}
        style={styles.bouton}
      />
    );
  }

  return (
    <View style={styles.carte}>
      <Text style={styles.titre}>Annuler cette commande ?</Text>
      <Text style={styles.texte}>L’annulation est gratuite tant que le commerce n’a pas commencé la préparation. Il sera prévenu.</Text>
      <Champ
        libelle="Motif (facultatif)"
        value={motif}
        onChangeText={setMotif}
        maxLength={MOTIF_ANNULATION_MAX}
        multiline
        editable={!envoi}
      />
      <MessageErreur message={erreur} />
      <Bouton titre="Confirmer l’annulation" variante="danger" chargement={envoi} onPress={() => void annuler()} />
      <Bouton titre="Garder ma commande" variante="discret" desactive={envoi} onPress={() => { setConfirmation(false); setErreur(null); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  bouton: { marginTop: 18 },
  carte: { marginTop: 18, padding: 16, borderRadius: 18, backgroundColor: theme.erreurFond, gap: 8 },
  titre: { fontSize: 16, fontWeight: '700', color: theme.texte },
  texte: { fontSize: 14, color: theme.secondaire, marginBottom: 4 },
});
