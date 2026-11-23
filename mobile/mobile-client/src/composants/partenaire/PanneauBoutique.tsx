import Ionicons from '@expo/vector-icons/Ionicons';
import { MessageErreur, api, type BoutiqueEtat } from '@fleetpulse/shared';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme';

const DUREES = [{ minutes: 15, libelle: '15 min' }, { minutes: 30, libelle: '30 min' }, { minutes: 60, libelle: '1 h' }];

/** US-2B6 : le commerce ferme sa boutique quelques minutes, ou la reprend. */
export function PanneauBoutique() {
  const [etat, setEtat] = useState<BoutiqueEtat | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    let actif = true;
    api.boutique()
      .then((e) => { if (actif) { setEtat(e); setErreur(null); } })
      .catch((e: unknown) => { if (actif) setErreur(e instanceof Error ? e.message : 'Boutique indisponible.'); });
    return () => { actif = false; };
  }, []);

  async function action(faire: () => Promise<BoutiqueEtat>) {
    setEnvoi(true);
    setErreur(null);
    try { setEtat(await faire()); }
    catch (e) { setErreur(e instanceof Error ? e.message : 'Action impossible.'); }
    finally { setEnvoi(false); }
  }

  const enPause = etat ? !etat.acceptePourCommandes && etat.pauseJusqua != null : false;
  const ouverte = etat?.acceptePourCommandes ?? false;

  return (
    <View style={styles.carte}>
      <View style={styles.entete}>
        <View style={[styles.pastille, { backgroundColor: ouverte ? theme.accent : theme.secondaire }]} />
        <Text style={styles.titre}>{ouverte ? 'Boutique ouverte' : enPause ? 'En pause' : 'Boutique fermée'}</Text>
      </View>
      {etat?.pauseJusqua && enPause ? <Text style={styles.texte}>Reprise automatique à {new Date(etat.pauseJusqua).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</Text> : null}
      {etat && etat.expirationsConsecutives > 0 && ouverte ? <Text style={styles.texte}>{etat.expirationsConsecutives} commande{etat.expirationsConsecutives > 1 ? 's' : ''} sans réponse. Répondez vite pour éviter une pause automatique.</Text> : null}
      <MessageErreur message={erreur} />
      {ouverte ? (
        <View style={styles.ligne}>
          {DUREES.map((d) => (
            <Pressable key={d.minutes} disabled={envoi} onPress={() => void action(() => api.pauseBoutique(d.minutes))} style={styles.chip}>
              <Ionicons name="pause" size={14} color={theme.texte} />
              <Text style={styles.chipTexte}>{d.libelle}</Text>
            </Pressable>
          ))}
        </View>
      ) : enPause ? (
        <Pressable disabled={envoi} onPress={() => void action(() => api.reprendreBoutique())} style={styles.principal}>
          <Text style={styles.principalTexte}>Reprendre les commandes</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { backgroundColor: theme.surface, borderRadius: theme.rayon + 4, padding: 18, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  entete: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pastille: { width: 10, height: 10, borderRadius: 5 },
  titre: { fontSize: 17, fontWeight: '800', color: theme.texte },
  texte: { color: theme.secondaire, fontSize: 13, marginTop: 6 },
  ligne: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.surfaceAlt, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14 },
  chipTexte: { color: theme.texte, fontWeight: '700', fontSize: 13 },
  principal: { marginTop: 14, backgroundColor: theme.accent, borderRadius: theme.rayon, paddingVertical: 13, alignItems: 'center' },
  principalTexte: { color: theme.surAccent, fontWeight: '800' },
});
