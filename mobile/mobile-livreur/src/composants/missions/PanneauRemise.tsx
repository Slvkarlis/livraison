import Ionicons from '@expo/vector-icons/Ionicons';
import { Bouton, Champ, MessageErreur, api, ecartEncaissement, formatMontant, lireMontant, type Mission } from '@fleetpulse/shared';
import { useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme';
import { ScannerQr } from './ScannerQr';

const LONGUEUR_CODE = 6;

/**
 * US-306 : chez le client, 1) le coursier confirme le montant reellement encaisse (motif si ecart),
 * 2) il scanne le QR affiche par le client (US-305) ou saisit le code recu par SMS (US-310).
 */
export function PanneauRemise({ mission, onLivree }: { mission: Mission; onLivree: (mission: Mission) => void }) {
  const [montant, setMontant] = useState(String(mission.montantACollecter));
  const [motif, setMotif] = useState('');
  const [montantConfirme, setMontantConfirme] = useState(false);
  const [scannerOuvert, setScannerOuvert] = useState(false);
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const encaisse = lireMontant(montant);
  const ecart = encaisse == null ? 0 : ecartEncaissement(encaisse, mission.montantACollecter);
  const montantValide = encaisse != null && (ecart === 0 || motif.trim().length >= 5);

  async function valider(preuve: string) {
    if (encaisse == null) return;
    setScannerOuvert(false);
    setEnvoi(true);
    setErreur(null);
    try {
      onLivree(await api.validerRemise(mission.id, encaisse, ecart === 0 ? null : motif.trim(), preuve));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Remise impossible.');
    } finally {
      setEnvoi(false);
    }
  }

  if (!montantConfirme) {
    return (
      <View style={styles.carte}>
        <Text style={styles.titre}>1. Encaissement</Text>
        <Text style={styles.aide}>Total à encaisser : {formatMontant(mission.montantACollecter)}. Indiquez le montant réellement reçu.</Text>
        <Champ libelle="Montant encaissé (DT)" value={montant} onChangeText={setMontant} keyboardType="decimal-pad" />
        {encaisse == null ? <Text style={styles.alerte}>Montant invalide (3 décimales au plus).</Text> : null}
        {encaisse != null && ecart !== 0 ? (
          <>
            <Text style={styles.alerte}>
              Écart de {ecart > 0 ? '+' : ''}{formatMontant(ecart)} : le motif sera transmis au responsable.
            </Text>
            <Champ libelle="Motif de l’écart" value={motif} onChangeText={setMotif} placeholder="Ex. client sans monnaie" maxLength={300} />
          </>
        ) : null}
        <Bouton titre="Confirmer le montant" desactive={!montantValide} onPress={() => { setErreur(null); setMontantConfirme(true); }} />
      </View>
    );
  }

  const codeComplet = code.replace(/\s/g, '').length === LONGUEUR_CODE;
  return (
    <View style={styles.carte}>
      <Text style={styles.titre}>2. Remise au client</Text>
      <Text style={styles.aide}>
        Montant confirmé : {formatMontant(encaisse ?? 0)}.{' '}
        <Text style={styles.lien} onPress={() => setMontantConfirme(false)}>Modifier</Text>
      </Text>
      <Text style={styles.aide}>Demandez au client d’afficher son QR de remise dans l’application.</Text>
      <Bouton
        titre="Scanner le QR du client"
        chargement={envoi && !code}
        onPress={() => { setErreur(null); setScannerOuvert(true); }}
        icone={<Ionicons name="qr-code-outline" size={20} color={theme.surAccent} />}
      />
      <Text style={styles.ou}>ou saisissez le code à 6 chiffres reçu par SMS par le client</Text>
      <Champ
        libelle="Code de remise"
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        maxLength={LONGUEUR_CODE + 1}
        placeholder="123456"
        editable={!envoi}
      />
      <MessageErreur message={erreur} />
      <Bouton titre="Valider la remise" variante="secondaire" chargement={envoi && !!code} desactive={!codeComplet}
        onPress={() => void valider(code)} />

      <Modal visible={scannerOuvert} animationType="slide" onRequestClose={() => setScannerOuvert(false)}>
        <ScannerQr onScan={(contenu) => void valider(contenu)} onFermer={() => setScannerOuvert(false)} />
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
  alerte: { fontSize: 14, fontWeight: '600', color: theme.erreur },
  lien: { fontWeight: '700', color: theme.accent },
  ou: { fontSize: 13, color: theme.secondaire, textAlign: 'center', marginTop: 4 },
});
