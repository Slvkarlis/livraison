import {
  Carte,
  Chargement,
  Ligne,
  MODES_PAIEMENT,
  MessageErreur,
  PastilleStatut,
  api,
  couleurs,
  formatCreneau,
  formatHeure,
  formatJour,
  formatMontant,
  type Livraison,
} from '@fleetpulse/shared';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { ACCENT } from '../../theme';

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

  if (erreur) return <View style={styles.contenu}><MessageErreur message={erreur} /></View>;
  if (!livraison) return <Chargement />;

  const position = { latitude: livraison.latitude, longitude: livraison.longitude };
  const creee = new Date(livraison.dateCreation);

  return (
    <ScrollView contentContainerStyle={styles.contenu}>
      <View style={styles.entete}>
        <Text style={styles.code}>{livraison.codeSuivi}</Text>
        <PastilleStatut statut={livraison.statut} />
      </View>

      <View style={styles.carteGeo}>
        <MapView
          style={StyleSheet.absoluteFill}
          initialRegion={{ ...position, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
        >
          <Marker coordinate={position} pinColor={ACCENT} />
        </MapView>
      </View>

      <Carte>
        <Text style={styles.libelle}>Adresse de livraison</Text>
        <Text style={styles.adresse}>{livraison.adresse}</Text>
      </Carte>

      <Carte style={styles.bloc}>
        <Ligne libelle="Créneau" valeur={formatCreneau(livraison.creneauDebut, livraison.creneauFin)} />
        <Ligne libelle="Paiement" valeur={MODES_PAIEMENT[livraison.modePaiement]} />
        <Ligne libelle="Montant" valeur={formatMontant(livraison.montantACollecter)} />
        <Ligne libelle="Créée" valeur={`${formatJour(creee)}, ${formatHeure(creee)}`} />
      </Carte>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: 20, backgroundColor: couleurs.fond },
  entete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  code: { fontSize: 18, fontWeight: '700', color: couleurs.texte },
  carteGeo: { height: 200, borderRadius: 16, overflow: 'hidden', marginBottom: 16, backgroundColor: couleurs.surface },
  libelle: { fontSize: 13, color: couleurs.secondaire, marginBottom: 4 },
  adresse: { fontSize: 16, fontWeight: '500', color: couleurs.texte },
  bloc: { marginTop: 16 },
});
