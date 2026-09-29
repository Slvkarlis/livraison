import Ionicons from '@expo/vector-icons/Ionicons';
import {
  Chargement,
  Ligne,
  MODES_PAIEMENT,
  MessageErreur,
  PastilleStatut,
  api,
  formatCreneau,
  formatDistance,
  formatHeure,
  formatJour,
  formatMontant,
  type Livraison,
} from '@fleetpulse/shared';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { theme } from '../../theme';

export default function DetailCommande() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [livraison, setLivraison] = useState<Livraison | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    api.mesLivraisons()
      .then((liste) => {
        const trouvee = liste.find((l) => String(l.id) === id);
        if (trouvee) setLivraison(trouvee);
        else setErreur('Commande introuvable.');
      })
      .catch((e) => setErreur(e instanceof Error ? e.message : 'Chargement impossible.'));
  }, [id]);

  if (erreur) return <View style={styles.erreur}><MessageErreur message={erreur} /></View>;
  if (!livraison) return <Chargement />;

  const position = { latitude: livraison.latitude, longitude: livraison.longitude };
  const creee = new Date(livraison.dateCreation);
  const immediate = livraison.typeLivraison === 'IMMEDIATE';

  return (
    <ScrollView style={styles.page} bounces={false}>
      {/* Carte pleine largeur, sans arrondi : en mode "lite" sur Android (image statique fiable dans un ScrollView). */}
      <MapView
        style={styles.carteGeo}
        liteMode={Platform.OS === 'android'}
        initialRegion={{ ...position, latitudeDelta: 0.008, longitudeDelta: 0.008 }}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
      >
        <Marker coordinate={position} pinColor={theme.accent} />
      </MapView>

      <View style={styles.feuille}>
        <PastilleStatut statut={livraison.statut} />
        <Text style={styles.adresse}>{livraison.adresse}</Text>
        <Text style={styles.code}>Commande {livraison.codeSuivi}</Text>

        <View style={styles.moment}>
          <View style={[styles.icone, immediate && { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name={immediate ? 'flash' : 'calendar'} size={20} color={immediate ? '#B45309' : theme.accent} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.momentTitre}>{immediate ? 'Livraison immédiate' : 'Créneau planifié'}</Text>
            <Text style={styles.momentTexte}>{formatCreneau(livraison.creneauDebut, livraison.creneauFin)}</Text>
          </View>
        </View>

        <Text style={styles.section}>Paiement</Text>
        <View style={styles.bloc}>
          <Ligne
            libelle={`Livraison${livraison.distanceKm ? ` (${formatDistance(livraison.distanceKm)})` : ''}`}
            valeur={formatMontant(livraison.fraisLivraison || livraison.montantACollecter)}
          />
          {livraison.supplementImmediat > 0 ? (
            <Ligne libelle="Supplément immédiat" valeur={`+${formatMontant(livraison.supplementImmediat)}`} />
          ) : null}
          <View style={styles.separateur} />
          <Ligne libelle="Total à payer" valeur={formatMontant(livraison.montantACollecter)} fort />
          <Text style={styles.note}>{MODES_PAIEMENT[livraison.modePaiement]}, en espèces au livreur.</Text>
        </View>

        <Text style={styles.creee}>Commandée {formatJour(creee).toLowerCase()} à {formatHeure(creee)}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.surface },
  erreur: { flex: 1, padding: 20, paddingTop: 120, backgroundColor: theme.fond },
  carteGeo: { height: 300, backgroundColor: theme.fond },
  feuille: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -28,
    padding: 24,
    gap: 6,
  },
  adresse: { fontSize: 22, fontWeight: '800', color: theme.texte, letterSpacing: -0.4, marginTop: 10 },
  code: { fontSize: 13, color: theme.secondaire },
  moment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.fond,
    borderRadius: 18,
    padding: 14,
    marginTop: 18,
  },
  icone: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: theme.accentDoux,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  momentTitre: { fontSize: 15, fontWeight: '600', color: theme.texte },
  momentTexte: { fontSize: 14, color: theme.secondaire, marginTop: 2 },
  section: { fontSize: 17, fontWeight: '700', color: theme.texte, marginTop: 22, marginBottom: 4 },
  bloc: { backgroundColor: theme.fond, borderRadius: 18, padding: 14 },
  separateur: { height: 1, backgroundColor: theme.bordure, marginVertical: 6 },
  note: { fontSize: 13, color: theme.secondaire, marginTop: 6 },
  creee: { fontSize: 13, color: theme.secondaire, textAlign: 'center', marginTop: 20 },
});
