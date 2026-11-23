import Ionicons from '@expo/vector-icons/Ionicons';
import {
  Bouton,
  EntreeAnimee,
  MessageErreur,
  Pilule,
  api,
  delaiRenouvellementQr,
  formatHeure,
  useEvenementsCommandes,
  type CodeRemiseEnvoye,
} from '@fleetpulse/shared';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Easing, ScrollView, StyleSheet, Text, View } from 'react-native';
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
      // Commande deja remise : on montre la confirmation plutot qu'un cadre vide et une erreur
      const detail = (await api.mesLivraisons().catch(() => [])).find((l) => l.id === commandeId);
      if (detail?.statut === 'LIVREE') { setLivree(true); setErreur(null); return; }
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
        <EntreeAnimee rang={0} style={styles.centre}>
          <View style={styles.succesDisque}><Ionicons name="checkmark" size={56} color="#15171A" /></View>
          <Text style={styles.titre}>Commande livrée</Text>
          <Text style={styles.aide}>La remise a été validée. Merci !</Text>
        </EntreeAnimee>
      </View>
    );
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.contenu}>
      <EntreeAnimee rang={0} style={styles.tete}>
        <Pilule texte="Remise sécurisée" ton="verre" pulse={!!svg} />
        <Text style={styles.titre}>Mon QR de remise</Text>
        <Text style={styles.aide}>
          Montrez ce QR au livreur à la réception de votre colis, après lui avoir remis le montant. Il change toutes les 2 minutes :
          ne l’envoyez à personne.
        </Text>
      </EntreeAnimee>
      {erreur && !svg ? null : <EntreeAnimee rang={1} style={styles.scene}>
        <Halo actif={!!svg} />
        <View style={styles.cadre}>
          {svg ? <SvgXml xml={svg} width={248} height={248} /> : erreur ? null : <ActivityIndicator color={theme.accent} />}
          {(['hg', 'hd', 'bg', 'bd'] as const).map((c) => <View key={c} style={[styles.coin, styles[c]]} />)}
        </View>
      </EntreeAnimee>}
      <MessageErreur message={erreur} />
      {expireLe && svg ? <Text style={styles.discret}>Valable jusqu’à {formatHeure(new Date(expireLe))}, renouvelé automatiquement.</Text> : null}

      <View style={styles.secours}>
        <Text style={styles.sousTitre}>QR illisible ?</Text>
        <Text style={styles.aideClaire}>Recevez un code à 6 chiffres et donnez-le au livreur.</Text>
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

/** Halo ambre qui respire derriere le QR tant qu'il est valide. */
function Halo({ actif }: { actif: boolean }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!actif) return;
    const boucle = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    boucle.start();
    return () => boucle.stop();
  }, [actif, v]);
  return <Animated.View pointerEvents="none" style={[styles.halo, {
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.6] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.04] }) }],
  }]} />;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#1B1C1F' },
  centre: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  contenu: { padding: 22, gap: 14, alignItems: 'stretch', paddingBottom: 40 },
  tete: { gap: 10 },
  titre: { fontSize: 32, fontWeight: '800', color: '#FFFFFF', letterSpacing: -1 },
  sousTitre: { fontSize: 18, fontWeight: '800', color: theme.texte },
  aide: { fontSize: 15, color: '#C9CCD2', lineHeight: 21 },
  aideClaire: { fontSize: 15, color: theme.secondaire, lineHeight: 21 },
  scene: { alignSelf: 'center', width: 320, height: 320, alignItems: 'center', justifyContent: 'center', marginVertical: 10 },
  halo: { position: 'absolute', width: 320, height: 320, borderRadius: 60, backgroundColor: 'rgba(242,178,51,0.35)' },
  cadre: {
    width: 284,
    height: 284,
    padding: 18,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coin: { position: 'absolute', width: 34, height: 34, borderColor: '#F2B233' },
  hg: { top: 10, left: 10, borderTopWidth: 5, borderLeftWidth: 5, borderTopLeftRadius: 16 },
  hd: { top: 10, right: 10, borderTopWidth: 5, borderRightWidth: 5, borderTopRightRadius: 16 },
  bg: { bottom: 10, left: 10, borderBottomWidth: 5, borderLeftWidth: 5, borderBottomLeftRadius: 16 },
  bd: { bottom: 10, right: 10, borderBottomWidth: 5, borderRightWidth: 5, borderBottomRightRadius: 16 },
  discret: { fontSize: 13, color: '#9A9EA6', textAlign: 'center' },
  secours: { gap: 10, marginTop: 14, padding: 18, borderRadius: 24, backgroundColor: theme.surface },
  info: { fontSize: 14, color: theme.texte },
  succesDisque: { width: 112, height: 112, borderRadius: 56, backgroundColor: '#F2B233', alignItems: 'center', justifyContent: 'center', borderWidth: 10, borderColor: 'rgba(242,178,51,0.25)', marginBottom: 10 },
});
