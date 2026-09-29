import Ionicons from '@expo/vector-icons/Ionicons';
import {
  EtatVide,
  MessageErreur,
  PastilleStatut,
  api,
  formatCreneau,
  formatMontant,
  useAuth,
  type Livraison,
} from '@fleetpulse/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../theme';

export default function MesCommandes() {
  const { profil } = useAuth();
  const [livraisons, setLivraisons] = useState<Livraison[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [rafraichissement, setRafraichissement] = useState(false);

  const charger = useCallback(async () => {
    try {
      setLivraisons(await api.mesLivraisons());
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

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <FlatList
        data={livraisons ?? []}
        keyExtractor={(l) => String(l.id)}
        contentContainerStyle={styles.liste}
        refreshControl={<RefreshControl refreshing={rafraichissement} onRefresh={rafraichir} tintColor={theme.accent} />}
        ListHeaderComponent={
          <View>
            <Text style={styles.bonjour}>Bonjour {profil?.prenom}</Text>
            <Text style={styles.titre}>Où livre-t-on aujourd’hui ?</Text>

            <Pressable onPress={() => router.push('/nouvelle-commande')} style={({ pressed }) => [
              styles.nouvelle, pressed && { opacity: 0.9 },
            ]}>
              <View style={styles.nouvelleIcone}>
                <Ionicons name="add" size={28} color={theme.accent} />
              </View>
              <View style={styles.nouvelleTexte}>
                <Text style={styles.nouvelleTitre}>Nouvelle commande</Text>
                <Text style={styles.nouvelleSous}>Tout de suite ou sur un créneau</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color="#FFFFFF" />
            </Pressable>

            <MessageErreur message={erreur} />
            {livraisons && livraisons.length > 0 ? <Text style={styles.section}>Mes commandes</Text> : null}
          </View>
        }
        ListEmptyComponent={
          livraisons ? (
            <EtatVide
              titre="Aucune commande pour l’instant"
              texte="Vos commandes et leur suivi apparaîtront ici."
            />
          ) : (
            <ActivityIndicator color={theme.accent} style={styles.chargement} />
          )
        }
        ItemSeparatorComponent={() => <View style={styles.separateur} />}
        renderItem={({ item }) => <CarteCommande livraison={item} />}
      />
    </SafeAreaView>
  );
}

function CarteCommande({ livraison }: { livraison: Livraison }) {
  const immediate = livraison.typeLivraison === 'IMMEDIATE';
  return (
    <Pressable
      onPress={() => router.push(`/commande/${livraison.id}`)}
      style={({ pressed }) => [styles.carte, pressed && { opacity: 0.75 }]}
    >
      <View style={[styles.icone, immediate && styles.iconeImmediate]}>
        <Ionicons name={immediate ? 'flash' : 'calendar'} size={20} color={immediate ? '#B45309' : theme.accent} />
      </View>
      <View style={styles.carteCorps}>
        <View style={styles.carteEntete}>
          <Text style={styles.adresse} numberOfLines={1}>{livraison.adresse}</Text>
          <Text style={styles.montant}>{formatMontant(livraison.montantTotal)}</Text>
        </View>
        <Text style={styles.creneau}>
          {immediate ? 'Immédiate · ' : ''}{formatCreneau(livraison.creneauDebut, livraison.creneauFin)}
        </Text>
        <View style={styles.cartePied}>
          <PastilleStatut statut={livraison.statut} />
          {livraison.modePaiement === 'CARTE' && livraison.statutPaiement !== 'PAYE' ? (
            <Text style={styles.aPayer}>À payer</Text>
          ) : (
            <Text style={styles.code}>{livraison.codeSuivi}</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.fond },
  liste: { padding: 20, paddingBottom: 32 },
  bonjour: { fontSize: 15, color: theme.secondaire, marginTop: 8 },
  titre: { fontSize: 28, fontWeight: '800', color: theme.texte, letterSpacing: -0.8, marginTop: 2, marginBottom: 20 },
  nouvelle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: theme.accent,
    borderRadius: theme.rayon,
    padding: 18,
    marginBottom: 28,
    shadowColor: theme.accent,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  nouvelleIcone: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nouvelleTexte: { flex: 1 },
  nouvelleTitre: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  nouvelleSous: { fontSize: 14, color: '#DAD6FF', marginTop: 2 },
  section: { fontSize: 18, fontWeight: '700', color: theme.texte, marginBottom: 12 },
  chargement: { marginTop: 40 },
  separateur: { height: 12 },
  carte: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: theme.surface,
    borderRadius: theme.rayon,
    padding: 16,
    shadowColor: '#1E1B4B',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  icone: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: theme.accentDoux,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconeImmediate: { backgroundColor: '#FEF3C7' },
  carteCorps: { flex: 1, gap: 6 },
  carteEntete: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  adresse: { flex: 1, fontSize: 16, fontWeight: '600', color: theme.texte },
  montant: { fontSize: 16, fontWeight: '700', color: theme.texte },
  creneau: { fontSize: 14, color: theme.secondaire },
  cartePied: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  code: { fontSize: 12, color: theme.secondaire, letterSpacing: 0.3 },
  aPayer: { fontSize: 13, fontWeight: '700', color: '#B45309' },
});
