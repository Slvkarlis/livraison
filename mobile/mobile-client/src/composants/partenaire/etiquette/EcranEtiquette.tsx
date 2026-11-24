import Ionicons from '@expo/vector-icons/Ionicons';
import { Bouton, MessageErreur, api, useStyles, useTheme, type Theme } from '@fleetpulse/shared';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { ErreurPartenaire, SquelettePartenaire, useRessourcePartenaire } from '../InterfacePartenaire';
import { AnimationEtat } from '../AnimationEtat';
import { etiquetteHtml } from './etiquetteHtml';
import { imprimerEtiquette } from './imprimerEtiquette';
import { genererQrSvg } from '../../qrSvg';

const TAILLE_QR = 240;

// US-2B10 : etiquette du colis a imprimer et coller ; le livreur scanne le QR (ou saisit le code) a la collecte
export default function EcranEtiquette() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme(), styles = useStyles(fabriqueStyles);
  const [erreur, setErreur] = useState<string | null>(null);
  const [impression, setImpression] = useState(false);
  const [dialogueOuvert, setDialogueOuvert] = useState(false), verrou = useRef(false);
  const lire = useCallback(async () => {
    const etiquette = await api.etiquetteColis(Number(id));
    return { etiquette, qrSvg: await genererQrSvg(etiquette.contenuQr) };
  }, [id]);
  const r = useRessourcePartenaire(lire), etiquette = r.donnees?.etiquette, qrSvg = r.donnees?.qrSvg;

  async function imprimer() {
    if (!etiquette || !qrSvg || verrou.current) return;
    verrou.current = true;
    setImpression(true);
    setErreur(null);
    try {
      await imprimerEtiquette(etiquetteHtml(etiquette, qrSvg));
      setDialogueOuvert(true);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Impression impossible.');
    } finally {
      verrou.current = false;
      setImpression(false);
    }
  }

  if (!etiquette || !qrSvg) {
    return <View style={styles.page}><View style={styles.contenu}><ErreurPartenaire message={r.erreur} horsConnexion={r.horsConnexion} reessayer={() => void r.charger()} />{r.chargement ? <SquelettePartenaire /> : null}</View></View>;
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.contenu}>
      <ErreurPartenaire message={r.erreur} horsConnexion={r.horsConnexion} reessayer={() => void r.charger()} />
      <View style={styles.etiquette}>
        <Text style={styles.commerce}>{etiquette.nomCommerce}</Text>
        <View accessibilityLabel={`QR de collecte de la commande ${etiquette.codeSuivi}`}>
          <SvgXml xml={qrSvg} width={TAILLE_QR} height={TAILLE_QR} />
        </View>
        <View style={styles.codeFond}>
          <Text style={styles.code} accessibilityLabel={`Code de collecte ${etiquette.codeCollecte.split('').join(' ')}`}>
            {etiquette.codeCollecte}
          </Text>
        </View>
        <Text style={styles.aide}>Code de collecte · à scanner ou saisir par le livreur</Text>
        <Text style={styles.client}>
          {etiquette.clientPrenom} · {etiquette.nbArticles} article{etiquette.nbArticles > 1 ? 's' : ''}
        </Text>
        <Text style={styles.aide}>Commande {etiquette.codeSuivi}</Text>
        {/* Encoches de ticket de part et d'autre de la ligne de decoupe */}
        <View style={[styles.encoche, styles.encocheG]} />
        <View style={[styles.encoche, styles.encocheD]} />
      </View>

      <MessageErreur message={erreur} />
      {dialogueOuvert ? <View style={{ alignItems: 'center', gap: 8, padding: 16 }}><AnimationEtat etat="impression" /><Text accessibilityLiveRegion="polite" style={{ color: theme.texte, textAlign: 'center' }}>Dialogue d’impression ouvert. Vérifiez votre imprimante ou votre fichier PDF.</Text></View> : null}
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

function fabriqueStyles(theme: Theme) { return {
  page: { flex: 1, backgroundColor: theme.fond },
  contenu: { padding: 20, paddingBottom: 48, alignItems: 'stretch' },
  etiquette: {
    alignItems: 'center',
    gap: 6,
    padding: 24,
    borderRadius: 28,
    backgroundColor: theme.surface,
    borderWidth: 2,
    borderColor: theme.bordure,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  encoche: { position: 'absolute', top: '58%', width: 28, height: 28, borderRadius: 14, backgroundColor: theme.fond },
  encocheG: { left: -15 },
  encocheD: { right: -15 },
  codeFond: { marginTop: 10, paddingVertical: 10, paddingHorizontal: 22, borderRadius: 999, backgroundColor: theme.texte },
  commerce: { fontSize: 20, fontWeight: '800', color: theme.texte, letterSpacing: -0.4, marginBottom: 8 },
  code: { fontSize: 30, fontWeight: '800', letterSpacing: 6, color: theme.accent, fontVariant: ['tabular-nums'] },
  aide: { fontSize: 13, color: theme.secondaire, textAlign: 'center' },
  client: { fontSize: 17, fontWeight: '700', color: theme.texte, marginTop: 6 },
  bouton: { marginTop: 20 },
  note: { fontSize: 13, color: theme.texte, textAlign: 'center', marginTop: 12 },
} as const; }
