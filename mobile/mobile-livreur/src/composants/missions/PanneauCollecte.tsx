import Ionicons from '@expo/vector-icons/Ionicons';
import { Bouton, Champ, MessageErreur, api, type Mission } from '@fleetpulse/shared';
import { useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme';
import { ScannerQr } from './ScannerQr';

const LONGUEUR_CODE = 6;

// US-2B9 : a la boutique, le coursier scanne le QR du colis (ou saisit le code imprime dessous)
export function PanneauCollecte({ missionId, onCollectee }: { missionId: number; onCollectee: (mission: Mission) => void }) {
  const [scannerOuvert, setScannerOuvert] = useState(false);
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  /** contenu : le texte du QR scanne, ou le code saisi ; le backend accepte les deux. */
  async function confirmer(contenu: string) {
    setScannerOuvert(false);
    setEnvoi(true);
    setErreur(null);
    try {
      onCollectee(await api.confirmerCollecte(missionId, contenu));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Collecte impossible.');
    } finally {
      setEnvoi(false);
    }
  }

  const codeComplet = code.replace(/\s/g, '').length === LONGUEUR_CODE;

  return (
    <View style={styles.carte}>
      <Text style={styles.titre}>Collecte du colis</Text>
      <Text style={styles.aide}>Scannez l’étiquette collée sur le colis pour confirmer la prise en charge.</Text>

      <Bouton
        titre="Scanner le QR du colis"
        chargement={envoi && !code}
        onPress={() => { setErreur(null); setScannerOuvert(true); }}
        icone={<Ionicons name="qr-code-outline" size={20} color={theme.surAccent} />}
      />

      <Text style={styles.ou}>ou saisissez le code imprimé sous le QR</Text>
      <Champ
        libelle="Code de collecte"
        value={code}
        onChangeText={(texte) => setCode(texte.toUpperCase())}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={LONGUEUR_CODE + 1}
        placeholder="EX. K7Q2MX"
        editable={!envoi}
      />
      <MessageErreur message={erreur} />
      <Bouton titre="Confirmer la collecte" variante="secondaire" chargement={envoi && !!code} desactive={!codeComplet}
        onPress={() => void confirmer(code)} />

      <Modal visible={scannerOuvert} animationType="slide" onRequestClose={() => setScannerOuvert(false)}>
        <ScannerQr onScan={(contenu) => void confirmer(contenu)} onFermer={() => setScannerOuvert(false)} />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: {
    gap: 12,
    padding: 16,
    marginBottom: 20,
    borderRadius: theme.rayon,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.accent,
  },
  titre: { fontSize: 18, fontWeight: '800', color: theme.texte },
  aide: { fontSize: 14, color: theme.secondaire },
  ou: { fontSize: 13, color: theme.secondaire, textAlign: 'center', marginTop: 4 },
});
