import Ionicons from '@expo/vector-icons/Ionicons';
import { Bouton, Chargement, MessageErreur, api, type EtiquetteColis } from '@fleetpulse/shared';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { theme } from '../../../theme';
import { etiquetteHtml } from './etiquetteHtml';
import { imprimerEtiquette } from './imprimerEtiquette';
import { genererQrSvg } from './qrSvg';

const TAILLE_QR = 240;

// US-2B10 : etiquette du colis a imprimer et coller ; le livreur scanne le QR (ou saisit le code) a la collecte
export default function EcranEtiquette() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [etiquette, setEtiquette] = useState<EtiquetteColis | null>(null);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [impression, setImpression] = useState(false);

  useEffect(() => {
    let actif = true;
    async function charger() {
      try {
        const e = await api.etiquetteColis(Number(id));
        const svg = await genererQrSvg(e.contenuQr);
        if (!actif) return;
        setEtiquette(e);
        setQrSvg(svg);
      } catch (e) {
        if (actif) setErreur(e instanceof Error ? e.message : 'Étiquette indisponible.');
      }
    }
    void charger();
    return () => { actif = false; };
  }, [id]);

  async function imprimer() {
    if (!etiquette || !qrSvg) return;
    setImpression(true);
    setErreur(null);
    try {
      await imprimerEtiquette(etiquetteHtml(etiquette, qrSvg));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Impression impossible.');
    } finally {
      setImpression(false);
    }
  }

  if (!etiquette || !qrSvg) {
    return erreur ? <View style={styles.page}><View style={styles.contenu}><MessageErreur message={erreur} /></View></View> : <Chargement />;
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.contenu}>
      <View style={styles.etiquette}>
        <Text style={styles.commerce}>{etiquette.nomCommerce}</Text>
        <View accessibilityLabel={`QR de collecte de la commande ${etiquette.codeSuivi}`}>
          <SvgXml xml={qrSvg} width={TAILLE_QR} height={TAILLE_QR} />
        </View>
        <Text style={styles.code} accessibilityLabel={`Code de collecte ${etiquette.codeCollecte.split('').join(' ')}`}>
          {etiquette.codeCollecte}
        </Text>
        <Text style={styles.aide}>Code de collecte · à scanner ou saisir par le livreur</Text>
        <Text style={styles.client}>
          {etiquette.clientPrenom} · {etiquette.nbArticles} article{etiquette.nbArticles > 1 ? 's' : ''}
        </Text>
        <Text style={styles.aide}>Commande {etiquette.codeSuivi}</Text>
      </View>

      <MessageErreur message={erreur} />
      <Bouton
        titre="Imprimer l’étiquette"
        chargement={impression}
        onPress={() => void imprimer()}
        icone={<Ionicons name="print-outline" size={20} color={theme.surAccent} />}
        style={styles.bouton}
      />
      <Text style={styles.note}>Collez l’étiquette sur le colis. Le livreur la scanne pour confirmer la prise en charge.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.fond },
  contenu: { padding: 20, paddingBottom: 48, alignItems: 'stretch' },
  etiquette: {
    alignItems: 'center',
    gap: 6,
    padding: 20,
    borderRadius: 20,
    backgroundColor: theme.surface,
    borderWidth: 2,
    borderColor: theme.bordure,
    borderStyle: 'dashed',
  },
  commerce: { fontSize: 16, fontWeight: '700', color: theme.texte, marginBottom: 6 },
  code: { fontSize: 30, fontWeight: '800', letterSpacing: 6, color: theme.texte, marginTop: 8 },
  aide: { fontSize: 13, color: theme.secondaire, textAlign: 'center' },
  client: { fontSize: 17, fontWeight: '700', color: theme.texte, marginTop: 6 },
  bouton: { marginTop: 20 },
  note: { fontSize: 13, color: theme.secondaire, textAlign: 'center', marginTop: 12 },
});
