import {
  Bouton,
  Carte,
  EtatVide,
  MessageErreur,
  PastilleStatut,
  Titre,
  api,
  couleurs,
  formatCreneau,
  formatMontant,
  type Livraison,
} from '@fleetpulse/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ACCENT } from '../../theme';

export default function MesCommandes() {
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

  const nouvelleCommande = () => router.push('/nouvelle-commande');

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <FlatList
        data={livraisons ?? []}
        keyExtractor={(l) => String(l.id)}
        contentContainerStyle={styles.liste}
        refreshControl={<RefreshControl refreshing={rafraichissement} onRefresh={rafraichir} tintColor={ACCENT} />}
        ListHeaderComponent={
          <View>
            <Titre sousTitre="Suivez l'état de vos livraisons.">Mes commandes</Titre>
            <MessageErreur message={erreur} />
            {livraisons && livraisons.length > 0 ? (
              <Bouton titre="Nouvelle commande" onPress={nouvelleCommande} style={styles.nouvelle} />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          livraisons ? (
            <EtatVide
              titre="Aucune commande"
              texte="Créez votre première commande : adresse, créneau et paiement à la livraison."
              action={<Bouton titre="Nouvelle commande" onPress={nouvelleCommande} />}
            />
          ) : null
        }
        ItemSeparatorComponent={() => <View style={styles.separateur} />}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/commande/${item.id}`)}>
            {({ pressed }) => (
              <Carte style={pressed ? styles.presse : undefined}>
                <View style={styles.entete}>
                  <Text style={styles.code}>{item.codeSuivi}</Text>
                  <PastilleStatut statut={item.statut} />
                </View>
                <Text style={styles.adresse} numberOfLines={2}>{item.adresse}</Text>
                <View style={styles.pied}>
                  <Text style={styles.meta}>{formatCreneau(item.creneauDebut, item.creneauFin)}</Text>
                  <Text style={styles.montant}>{formatMontant(item.montantACollecter)}</Text>
                </View>
              </Carte>
            )}
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: couleurs.fond },
  liste: { padding: 20, paddingBottom: 32 },
  nouvelle: { marginBottom: 20 },
  separateur: { height: 12 },
  presse: { opacity: 0.7 },
  entete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  code: { fontSize: 13, fontWeight: '600', color: couleurs.secondaire, letterSpacing: 0.3 },
  adresse: { fontSize: 16, fontWeight: '500', color: couleurs.texte, marginTop: 10 },
  pied: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, gap: 8 },
  meta: { fontSize: 14, color: couleurs.secondaire, flexShrink: 1 },
  montant: { fontSize: 14, fontWeight: '600', color: couleurs.texte },
});
