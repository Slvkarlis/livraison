import Ionicons from '@expo/vector-icons/Ionicons';
import {
  Bouton,
  MessageErreur,
  api,
  delaiRenouvellementQr,
  formatHeure,
  useEvenementsCommandes,
  type CodeRemiseEnvoye,
} from '@fleetpulse/shared';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { theme } from '../../theme';
import { genererQrSvg } from '../qrSvg';

// US-305 : QR dynamique montre au livreur ; US-310 : code de secours par SMS si le QR ne peut pas etre lu
export default function EcranQrRemise() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const commandeId = Number(id);
  const [svg, setSvg] = useState<string | null>(null);
  const [expireLe, setExpireLe] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [livree, setLivree] = useState(false);
  const [code, setCode] = useState<CodeRemiseEnvoye | null>(null);
  const [erreurCode, setErreurCode] = useState<string | null>(null);
  const [envoiCode, setEnvoiCode] = useState(false);

  const charger = useCallback(async () => {
    try {
      const qr = await api.qrRemise(commandeId);
      setSvg(await genererQrSvg(qr.contenuQr));
      setExpireLe(qr.expireLe);
      setErreur(null);
    } catch (e) {
      setSvg(null);
      setErreur(e instanceof Error ? e.message : 'QR indisponible.');
    }
  }, [commandeId]);

  useFocusEffect(useCallback(() => { void charger(); }, [charger]));
  // Nouveau QR avant expiration : l'ancien devient invalide (une capture partagee ne sert a rien)
  useEffect(() => {
    if (!expireLe || livree) return;
    const minuterie = setTimeout(() => void charger(), delaiRenouvellementQr(expireLe));
    return () => clearTimeout(minuterie);
  }, [expireLe, livree, charger]);
  useEvenementsCommandes((e) => {
    if (e.commandeId !== commandeId) return;
    if (e.nouveau === 'LIVREE') { setLivree(true); setSvg(null); }
    else void charger();
  });

  async function demanderCode() {
    setEnvoiCode(true);
    setErreurCode(null);
    try {
      setCode(await api.demanderCodeRemise(commandeId));
    } catch (e) {
      setErreurCode(e instanceof Error ? e.message : 'Envoi impossible.');
    } finally {
      setEnvoiCode(false);
    }
  }

  if (livree) {
    return (
      <View style={[styles.page, styles.centre]}>
        <Ionicons name="checkmark-circle" size={72} color={theme.succes} />
        <Text style={styles.titre}>Commande livrée</Text>
        <Text style={styles.aide}>La remise a été validée. Merci !</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.contenu}>
      <Text style={styles.titre}>Mon QR de remise</Text>
      <Text style={styles.aide}>
        Montrez ce QR au livreur à la réception de votre colis, après lui avoir remis le montant. Il change toutes les 2 minutes :
        ne l’envoyez à personne.
      </Text>
      <View style={styles.cadre}>
        {svg ? <SvgXml xml={svg} width={260} height={260} /> : erreur ? null : <ActivityIndicator color={theme.accent} />}
      </View>
      <MessageErreur message={erreur} />
      {expireLe && svg ? <Text style={styles.discret}>Valable jusqu’à {formatHeure(new Date(expireLe))}, renouvelé automatiquement.</Text> : null}

      <View style={styles.secours}>
        <Text style={styles.sousTitre}>QR illisible ?</Text>
        <Text style={styles.aide}>Recevez un code à 6 chiffres et donnez-le au livreur.</Text>
        {code ? (
          <Text style={styles.info}>
            Code envoyé par {code.destination}.
            {code.prochainEnvoiPossibleLe ? ` Nouvel envoi possible après ${formatHeure(new Date(code.prochainEnvoiPossibleLe))}.` : ''}
          </Text>
        ) : null}
        <MessageErreur message={erreurCode} />
        <Bouton titre={code ? 'Renvoyer un code' : 'Recevoir un code par SMS'} variante="secondaire" chargement={envoiCode}
          onPress={() => void demanderCode()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.surface },
  centre: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  contenu: { padding: 24, gap: 12, alignItems: 'stretch' },
  titre: { fontSize: 24, fontWeight: '800', color: theme.texte },
  sousTitre: { fontSize: 17, fontWeight: '700', color: theme.texte },
  aide: { fontSize: 15, color: theme.secondaire, lineHeight: 21 },
  cadre: {
    alignSelf: 'center',
    width: 292,
    height: 292,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  discret: { fontSize: 13, color: theme.secondaire, textAlign: 'center' },
  secours: { gap: 10, marginTop: 20, padding: 16, borderRadius: 18, backgroundColor: theme.fond },
  info: { fontSize: 14, color: theme.texte },
});
