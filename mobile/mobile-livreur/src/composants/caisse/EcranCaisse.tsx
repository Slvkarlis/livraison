import Ionicons from '@expo/vector-icons/Ionicons';
import {
  EntreeAnimee,
  EtatVide,
  Pilule,
  Ville3D,
  MessageErreur,
  api,
  conseilDepot,
  formatHeure,
  formatMontant,
  libelleSemaine,
  useEvenementsCommandes,
  type CaisseLivreur,
} from '@fleetpulse/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../theme';

function jourHeure(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${formatHeure(d)}`;
}

// US-504 : solde de cash, commandes encaissees, recus de depot ; US-512 : remuneration et releves hebdomadaires
export default function EcranCaisse() {
  const [caisse, setCaisse] = useState<CaisseLivreur | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [rafraichissement, setRafraichissement] = useState(false);

  const charger = useCallback(async () => {
    try {
      setCaisse(await api.caisse());
      setErreur(null);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Chargement impossible.');
    }
  }, []);
  useFocusEffect(useCallback(() => { void charger(); }, [charger]));
  // Une remise validee ajoute une commande encaissee
  useEvenementsCommandes(() => { void charger(); });

  async function rafraichir() {
    setRafraichissement(true);
    await charger();
    setRafraichissement(false);
  }

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <ScrollView contentContainerStyle={styles.contenu}
        refreshControl={<RefreshControl refreshing={rafraichissement} onRefresh={rafraichir} tintColor={theme.accent} />}>
        <Text style={styles.titre}>Caisse</Text>
        <MessageErreur message={erreur} />
        {!caisse ? <ActivityIndicator color={theme.accent} style={styles.chargement} /> : (
          <>
            <EntreeAnimee rang={0}>
              <View style={styles.solde}>
                <Ville3D ton="nuit" fondu="#1B1C1F" progression={0.9} style={styles.soldeVille} />
                <View style={styles.soldeHaut}>
                  <Text style={styles.libelle}>CASH À DÉPOSER</Text>
                  <Pilule texte={caisse.solde > 0 ? 'À déposer' : 'Rien à déposer'} ton={caisse.solde > 0 ? 'verre' : 'succes'} pulse={caisse.solde > 0} />
                </View>
                <View>
                  <Text style={styles.montant} adjustsFontSizeToFit numberOfLines={1}>{formatMontant(caisse.solde)}</Text>
                  <Text style={styles.conseil}>{conseilDepot(caisse)}</Text>
                </View>
              </View>
            </EntreeAnimee>

            <EntreeAnimee rang={1}>
              <View style={styles.duo}>
                <View style={[styles.tuile, styles.tuileClaire]}>
                  <Text style={styles.tuileLibelle}>Rémunération en attente</Text>
                  <Text style={styles.tuileValeur} adjustsFontSizeToFit numberOfLines={1}>{formatMontant(caisse.remunerationEnAttente)}</Text>
                  <Text style={styles.tuileNote}>payée au prochain closing</Text>
                </View>
                <View style={styles.tuile}>
                  <Text style={[styles.tuileLibelle, styles.surNuit]}>Missions</Text>
                  <Text style={[styles.tuileValeur, styles.blanc]}>{caisse.missionsEnAttente}</Text>
                  <Text style={[styles.tuileNote, styles.surNuit]}>livrée{caisse.missionsEnAttente > 1 ? 's' : ''} cette période</Text>
                </View>
              </View>
            </EntreeAnimee>

            {caisse.commandes.length > 0 ? (
              <View style={styles.carte}>
                <Text style={styles.section}>COMMANDES ENCAISSÉES</Text>
                {caisse.commandes.map((c) => (
                  <View key={c.commandeId} style={styles.ligne}>
                    <View style={styles.flex}>
                      <Text accessibilityRole="link" onPress={() => router.push(`/mission/${c.commandeId}`)} style={styles.texte}>{c.nomCommerce ?? c.codeSuivi} · Noter le client</Text>
                      <Text style={styles.discret}>{c.codeSuivi} · {jourHeure(c.livreeLe)}</Text>
                    </View>
                    <Text style={styles.texteFort}>{formatMontant(c.montantEncaisse)}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.carte}>
              <Text style={styles.section}>REÇUS DE DÉPÔT</Text>
              {caisse.recus.length ? caisse.recus.map((r) => (
                <View key={r.id} style={styles.ligne}>
                  <Ionicons name={r.statut === 'RAPPROCHE' ? 'checkmark-circle' : 'alert-circle'} size={18}
                    color={r.statut === 'RAPPROCHE' ? theme.succes : theme.erreur} />
                  <View style={styles.flex}>
                    <Text style={styles.texte}>{r.numeroRecu}</Text>
                    <Text style={styles.discret}>{jourHeure(r.date)} · {r.nbCommandes} commande{r.nbCommandes > 1 ? 's' : ''}
                      {r.statut === 'ECART' ? ` · écart ${formatMontant(r.ecart)}` : ''}</Text>
                  </View>
                  <Text style={styles.texteFort}>{formatMontant(r.montantRecu)}</Text>
                </View>
              )) : <EtatVide titre="Aucun dépôt" texte="Vos reçus apparaîtront ici après chaque dépôt." />}
            </View>

            {caisse.releves.length > 0 ? (
              <View style={styles.carte}>
                <Text style={styles.section}>RELEVÉS HEBDOMADAIRES</Text>
                {caisse.releves.map((r) => (
                  <View key={r.closingId} style={styles.ligne}>
                    <View style={styles.flex}>
                      <Text style={styles.texte}>{libelleSemaine(r.semaine)}</Text>
                      <Text style={styles.discret}>{r.nbMissions} mission{r.nbMissions > 1 ? 's' : ''} · {r.distanceKm.toFixed(1).replace('.', ',')} km</Text>
                    </View>
                    <Text style={styles.texteFort}>{formatMontant(r.remuneration)}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.fond },
  contenu: { padding: 20, paddingBottom: 40, gap: 14 },
  titre: { fontSize: 40, fontWeight: '800', color: theme.texte, marginTop: 8, letterSpacing: -1.2 },
  chargement: { marginTop: 40 },
  solde: { minHeight: 230, padding: 20, borderRadius: 28, backgroundColor: '#1B1C1F', overflow: 'hidden', justifyContent: 'space-between', borderWidth: 1, borderColor: theme.bordure },
  soldeVille: { position: 'absolute', top: 0, bottom: 0, right: 0, left: '30%' },
  soldeHaut: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  libelle: { fontSize: 12, fontWeight: '700', color: '#9A9EA6', letterSpacing: 1.5 },
  montant: { fontSize: 46, fontWeight: '800', color: theme.accent, letterSpacing: -1.4, fontVariant: ['tabular-nums'] },
  conseil: { fontSize: 13, color: '#C9CCD2', marginTop: 4, maxWidth: '75%' },
  duo: { flexDirection: 'row', gap: 12 },
  tuile: { flex: 1, padding: 16, borderRadius: 24, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.bordure, gap: 4 },
  tuileClaire: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  tuileLibelle: { fontSize: 12, fontWeight: '600', color: '#6B6F76' },
  tuileValeur: { fontSize: 26, fontWeight: '800', color: '#15171A', letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  tuileNote: { fontSize: 12, color: '#6B6F76' },
  surNuit: { color: '#9A9EA6' },
  blanc: { color: '#F4F3EF' },
  carte: { gap: 12, padding: 18, borderRadius: 24, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.bordure },
  section: { fontSize: 12, fontWeight: '700', color: theme.secondaire, letterSpacing: 1.5 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1, gap: 2 },
  texte: { fontSize: 15, color: theme.texte },
  texteFort: { fontSize: 15, fontWeight: '700', color: theme.texte },
  discret: { fontSize: 13, color: theme.secondaire },
});
