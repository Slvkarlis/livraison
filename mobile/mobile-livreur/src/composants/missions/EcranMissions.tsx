import {
  EtatVide,
  MessageErreur,
  api,
  useAuth,
  useEvenementsCommandes,
  useTempsReelConnecte,
  type Disponibilite,
  type Mission,
} from '@fleetpulse/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../theme';
import { CarteDisponibilite } from './CarteDisponibilite';
import { CarteMission } from './CarteMission';

// US-2B8 : onglet Missions du coursier (disponibilite + missions de collecte affectees, en temps reel)
export default function EcranMissions() {
  const { profil } = useAuth();
  const [disponibilite, setDisponibilite] = useState<Disponibilite | null>(null);
  const [missions, setMissions] = useState<Mission[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [rafraichissement, setRafraichissement] = useState(false);
  const enDirect = useTempsReelConnecte();

  const charger = useCallback(async () => {
    try {
      const [d, m] = await Promise.all([api.disponibilite(), api.missions()]);
      setDisponibilite(d);
      setMissions(m);
      setErreur(null);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Chargement impossible.');
    }
  }, []);

  useFocusEffect(useCallback(() => { void charger(); }, [charger]));
  // Temps reel : nouvelle mission affectee, ou commande modifiee (annulation, collecte...)
  useEvenementsCommandes(() => { void api.missions().then(setMissions).catch(() => {}); });

  async function rafraichir() {
    setRafraichissement(true);
    await charger();
    setRafraichissement(false);
  }

  async function apresChangementDisponibilite(maj: Disponibilite) {
    setDisponibilite(maj);
    // En devenant disponible, le coursier peut recevoir aussitot les commandes pretes qui attendaient
    setMissions(await api.missions());
  }

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <FlatList
        data={missions ?? []}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={styles.liste}
        refreshControl={<RefreshControl refreshing={rafraichissement} onRefresh={rafraichir} tintColor={theme.accent} />}
        ListHeaderComponent={
          <View style={styles.entete}>
            <View style={styles.ligneHaut}>
              <Text style={styles.bonjour}>Bonjour {profil?.prenom}</Text>
              <Text style={[styles.direct, { color: enDirect ? theme.accent : theme.secondaire }]}>
                {enDirect ? '● En direct' : '○ Hors ligne'}
              </Text>
            </View>
            <Text style={styles.titre}>Missions</Text>
            <MessageErreur message={erreur} />
            {disponibilite ? <CarteDisponibilite disponibilite={disponibilite} onChange={(d) => void apresChangementDisponibilite(d)} /> : null}
            {missions && missions.length > 0 ? <Text style={styles.section}>À COLLECTER</Text> : null}
          </View>
        }
        ListEmptyComponent={
          missions ? (
            <EtatVide
              titre="Aucune mission"
              texte={disponibilite?.disponible
                ? 'Vous serez prévenu dès qu’une commande de vos zones est prête.'
                : 'Déclarez-vous disponible pour recevoir des missions.'}
            />
          ) : (
            <ActivityIndicator color={theme.accent} style={styles.chargement} />
          )
        }
        ItemSeparatorComponent={() => <View style={styles.separateur} />}
        renderItem={({ item }) => <CarteMission mission={item} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.fond },
  liste: { padding: 20, paddingBottom: 40, flexGrow: 1 },
  entete: { gap: 14, marginBottom: 14 },
  ligneHaut: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  bonjour: { fontSize: 15, color: theme.secondaire },
  direct: { fontSize: 12, fontWeight: '700' },
  titre: { fontSize: 28, fontWeight: '800', color: theme.texte, marginTop: -8 },
  section: { fontSize: 12, fontWeight: '700', color: theme.secondaire, letterSpacing: 1.5, marginTop: 10 },
  chargement: { marginTop: 40 },
  separateur: { height: 12 },
});
