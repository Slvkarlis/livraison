import Ionicons from '@expo/vector-icons/Ionicons';
import { Chargement, MessageErreur, api, formatHeure, formatMontant, useEvenementsCommandes, type Mission } from '@fleetpulse/shared';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme';
import { PanneauCollecte } from './PanneauCollecte';

/** Itineraire vers le commerce dans l'application de cartes du telephone (ou Google Maps dans le navigateur). */
function lienItineraire(m: Mission): string | null {
  if (m.latitudeCommerce == null || m.longitudeCommerce == null) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${m.latitudeCommerce},${m.longitudeCommerce}`;
}

// US-2B8 : detail d'une mission de collecte ; US-2B9 : confirmation de la collecte par scan du QR
export default function EcranMission() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [mission, setMission] = useState<Mission | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    try {
      setMission(await api.mission(Number(id)));
      setErreur(null);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Mission introuvable.');
    }
  }, [id]);

  useFocusEffect(useCallback(() => { void charger(); }, [charger]));
  useEvenementsCommandes((e) => { if (e.commandeId === Number(id)) void charger(); });

  if (!mission) return erreur ? <View style={styles.page}><View style={styles.contenu}><MessageErreur message={erreur} /></View></View> : <Chargement />;

  const itineraire = lienItineraire(mission);
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.contenu}>
      <Text style={styles.etiquette}>COLLECTE</Text>
      <View style={styles.bloc}>
        <Text style={styles.commerce}>{mission.nomCommerce}</Text>
        <Text style={styles.texte}>{mission.adresseCommerce}</Text>
        {mission.preteLe ? <Text style={styles.discret}>Prête depuis {formatHeure(new Date(mission.preteLe))}</Text> : null}
        {itineraire ? (
          <Text accessibilityRole="link" style={styles.lien} onPress={() => void Linking.openURL(itineraire)}>
            <Ionicons name="navigate-outline" size={15} color={theme.accent} /> Itinéraire vers le commerce
          </Text>
        ) : null}
      </View>

      <Text style={styles.etiquette}>COMMANDE</Text>
      <View style={styles.bloc}>
        <Ligne libelle="Code" valeur={mission.codeSuivi} />
        <Ligne libelle="Client" valeur={mission.clientPrenom} />
        <Ligne libelle="Articles" valeur={String(mission.nbArticles)} />
        {mission.zoneNom ? <Ligne libelle="Zone" valeur={mission.zoneNom} /> : null}
        <Ligne libelle="À encaisser à la livraison" valeur={formatMontant(mission.montantACollecter)} fort />
      </View>

      {mission.statut === 'AFFECTEE' ? <PanneauCollecte missionId={mission.id} onCollectee={setMission} /> : null}
      {mission.statut === 'RECUPEREE' && mission.recupereeLe ? (
        <View style={styles.collectee}>
          <Ionicons name="checkmark-circle" size={22} color={theme.accent} />
          <Text style={styles.collecteeTexte}>Colis récupéré à {formatHeure(new Date(mission.recupereeLe))}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function Ligne({ libelle, valeur, fort }: { libelle: string; valeur: string; fort?: boolean }) {
  return (
    <View style={styles.ligne}>
      <Text style={styles.discret}>{libelle}</Text>
      <Text style={[styles.texte, fort && styles.fort]}>{valeur}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.fond },
  contenu: { padding: 20, paddingBottom: 48 },
  etiquette: { fontSize: 12, fontWeight: '700', color: theme.secondaire, letterSpacing: 1.5, marginBottom: 10, marginTop: 8 },
  bloc: {
    gap: 6,
    padding: 16,
    marginBottom: 20,
    borderRadius: theme.rayon,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.bordure,
  },
  commerce: { fontSize: 20, fontWeight: '800', color: theme.texte },
  texte: { fontSize: 15, color: theme.texte },
  discret: { fontSize: 14, color: theme.secondaire },
  fort: { fontWeight: '800', color: theme.accent },
  lien: { fontSize: 15, fontWeight: '700', color: theme.accent, marginTop: 6 },
  ligne: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 2 },
  collectee: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderRadius: theme.rayon,
    backgroundColor: theme.accentDoux,
  },
  collecteeTexte: { fontSize: 16, fontWeight: '700', color: theme.texte },
});
