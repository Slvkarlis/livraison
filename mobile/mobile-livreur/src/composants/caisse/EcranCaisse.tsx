import Ionicons from '@expo/vector-icons/Ionicons';
import {
  EtatVide,
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
            <View style={styles.solde}>
              <Text style={styles.libelle}>CASH À DÉPOSER</Text>
              <Text style={styles.montant}>{formatMontant(caisse.solde)}</Text>
              <Text style={styles.conseil}>{conseilDepot(caisse)}</Text>
            </View>

            <View style={styles.carte}>
              <Text style={styles.section}>RÉMUNÉRATION EN ATTENTE</Text>
              <Text style={styles.ligneForte}>{formatMontant(caisse.remunerationEnAttente)}</Text>
              <Text style={styles.discret}>{caisse.missionsEnAttente} mission{caisse.missionsEnAttente > 1 ? 's' : ''} livrée{caisse.missionsEnAttente > 1 ? 's' : ''}, payée{caisse.missionsEnAttente > 1 ? 's' : ''} au prochain closing</Text>
            </View>

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
  titre: { fontSize: 28, fontWeight: '800', color: theme.texte, marginTop: 8 },
  chargement: { marginTop: 40 },
  solde: { gap: 4, padding: 18, borderRadius: theme.rayon, backgroundColor: theme.accentDoux, borderWidth: 1, borderColor: theme.accent },
  libelle: { fontSize: 12, fontWeight: '700', color: theme.accent, letterSpacing: 1.5 },
  montant: { fontSize: 32, fontWeight: '800', color: theme.texte, fontVariant: ['tabular-nums'] },
  conseil: { fontSize: 13, color: theme.secondaire },
  carte: { gap: 10, padding: 16, borderRadius: theme.rayon, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.bordure },
  section: { fontSize: 12, fontWeight: '700', color: theme.secondaire, letterSpacing: 1.5 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1, gap: 2 },
  texte: { fontSize: 15, color: theme.texte },
  texteFort: { fontSize: 15, fontWeight: '700', color: theme.texte },
  ligneForte: { fontSize: 22, fontWeight: '800', color: theme.texte },
  discret: { fontSize: 13, color: theme.secondaire },
});
