import Ionicons from '@expo/vector-icons/Ionicons';
import {
  EtatVide,
  GROUPES_COMMANDES,
  MessageErreur,
  PastilleStatut,
  api,
  compterParGroupe,
  formatHeure,
  formatJour,
  formatMontant,
  groupeDe,
  libelleStatutPartenaire,
  useAuth,
  type CommandeResume,
  type GroupeCommandes,
} from '@fleetpulse/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../theme';
import { Puce } from './Puce';

const VIDES: Record<GroupeCommandes, { titre: string; texte: string }> = {
  nouvelles: { titre: 'Aucune nouvelle commande', texte: 'Les commandes de vos clients apparaîtront ici.' },
  'en-cours': { titre: 'Rien en préparation', texte: 'Les commandes acceptées apparaîtront ici.' },
  pretes: { titre: 'Aucune commande prête', texte: 'Les commandes prêtes à être récupérées apparaîtront ici.' },
  terminees: { titre: 'Aucune commande terminée', texte: 'Les commandes récupérées, refusées ou annulées apparaîtront ici.' },
};

// US-2B1 : commandes recues par le partenaire, filtrees par groupe de statuts
export default function CommandesRecues() {
  const { profil } = useAuth();
  const [commandes, setCommandes] = useState<CommandeResume[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [groupe, setGroupe] = useState<GroupeCommandes>('nouvelles');
  const [rafraichissement, setRafraichissement] = useState(false);

  const charger = useCallback(async () => {
    try {
      setCommandes(await api.commandesRecues());
      setErreur(null);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Chargement impossible.');
    }
  }, []);

  useFocusEffect(useCallback(() => { void charger(); }, [charger]));

  async function rafraichir() {
    setRafraichissement(true);
    await charger();
    setRafraichissement(false);
  }

  const compte = useMemo(() => compterParGroupe(commandes ?? []), [commandes]);
  const visibles = useMemo(() => (commandes ?? []).filter((c) => groupeDe(c.statut) === groupe), [commandes, groupe]);

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <FlatList
        data={visibles}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={styles.liste}
        refreshControl={<RefreshControl refreshing={rafraichissement} onRefresh={rafraichir} tintColor={theme.accent} />}
        ListHeaderComponent={
          <View>
            <Text style={styles.bonjour}>Bonjour {profil?.prenom}</Text>
            <Text style={styles.titre}>Commandes reçues</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtres}>
              {GROUPES_COMMANDES.map((g) => (
                <Puce key={g.id} libelle={g.libelle} actif={g.id === groupe} compteur={compte[g.id]} onPress={() => setGroupe(g.id)} />
              ))}
            </ScrollView>
            <MessageErreur message={erreur} />
          </View>
        }
        ListEmptyComponent={
          commandes ? (
            <EtatVide titre={VIDES[groupe].titre} texte={VIDES[groupe].texte} />
          ) : (
            <ActivityIndicator color={theme.accent} style={styles.chargement} />
          )
        }
        ItemSeparatorComponent={() => <View style={styles.separateur} />}
        renderItem={({ item }) => <CarteCommandeRecue commande={item} />}
      />
    </SafeAreaView>
  );
}

function CarteCommandeRecue({ commande }: { commande: CommandeResume }) {
  const recue = new Date(commande.dateCreation);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Commande ${commande.codeSuivi} de ${commande.clientPrenom}`}
      onPress={() => router.push(`/partenaire/commande/${commande.id}`)}
      style={({ pressed }) => [styles.carte, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.carteIcone}>
        <Ionicons name="receipt-outline" size={20} color={theme.accent} />
      </View>
      <View style={styles.carteCorps}>
        <View style={styles.carteEntete}>
          <Text style={styles.client} numberOfLines={1}>{commande.clientPrenom}</Text>
          <Text style={styles.montant}>{formatMontant(commande.total)}</Text>
        </View>
        <Text style={styles.details}>
          {commande.nbArticles} article{commande.nbArticles > 1 ? 's' : ''} · {formatJour(recue)} à {formatHeure(recue)}
        </Text>
        <Text style={styles.code} numberOfLines={1}>{commande.codeSuivi}</Text>
        <View style={styles.cartePied}>
          <PastilleStatut statut={commande.statut} libelle={libelleStatutPartenaire(commande.statut)} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.fond },
  liste: { padding: 20, paddingBottom: 40, flexGrow: 1 },
  bonjour: { fontSize: 15, color: theme.secondaire },
  titre: { fontSize: 28, fontWeight: '800', color: theme.texte, letterSpacing: -0.5, marginTop: 2 },
  filtres: { gap: 8, paddingVertical: 18 },
  chargement: { marginTop: 40 },
  separateur: { height: 12 },
  carte: {
    flexDirection: 'row',
    gap: 14,
    padding: 16,
    borderRadius: 20,
    backgroundColor: theme.surface,
  },
  carteIcone: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: theme.accentDoux,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carteCorps: { flex: 1, gap: 6 },
  carteEntete: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  client: { flex: 1, fontSize: 16, fontWeight: '700', color: theme.texte },
  montant: { fontSize: 16, fontWeight: '700', color: theme.texte },
  details: { fontSize: 14, color: theme.secondaire },
  cartePied: { flexDirection: 'row', marginTop: 2 },
  code: { fontSize: 12, color: theme.secondaire },
});
