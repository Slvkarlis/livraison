import { Bouton, useConfiguration, type Mission } from '@fleetpulse/shared';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme';
import { useSuiviPosition } from './SuiviPosition';

function heureSecondes(date: Date): string {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** Premiere livraison en cours dont le trajet commerce -> client peut etre simule. */
function livraisonASimuler(missions: Mission[]): Mission | undefined {
  return missions.find((m) => (m.statut === 'RECUPEREE' || m.statut === 'A_PROXIMITE')
    && m.latitudeCommerce != null && m.longitudeCommerce != null && m.latitudeLivraison != null && m.longitudeLivraison != null);
}

// US-301 : etat de la transmission GPS pendant les missions (et simulation du trajet en demonstration)
export function CarteSuiviGps() {
  const { demonstration } = useConfiguration();
  const { actif, missions, dernierEnvoi, ecarte, erreur, simulation, simuler, arreterSimulation } = useSuiviPosition();
  if (!actif) return null;
  const aSimuler = demonstration ? livraisonASimuler(missions) : undefined;

  return (
    <View style={styles.carte}>
      <View style={styles.entete}>
        <View style={[styles.point, { backgroundColor: erreur ? theme.erreur : theme.accent }]} />
        <Text style={styles.titre}>Suivi GPS {erreur ? 'interrompu' : 'actif'}</Text>
      </View>
      <Text style={styles.texte}>
        {dernierEnvoi ? `Position transmise à ${heureSecondes(dernierEnvoi)}` : 'Le client suivra votre position pendant la livraison.'}
      </Text>
      {ecarte ? <Text style={styles.texte}>Dernier point ignoré : {ecarte}</Text> : null}
      {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}
      {demonstration && !aSimuler && !simulation ? (
        <Text style={styles.demo}>Mode démonstration : le trajet pourra être simulé une fois le colis récupéré.</Text>
      ) : null}
      {aSimuler && !simulation ? (
        <Bouton titre={`Simuler le trajet vers ${aSimuler.clientPrenom}`} variante="secondaire" onPress={() => simuler(
          { latitude: aSimuler.latitudeCommerce!, longitude: aSimuler.longitudeCommerce! },
          { latitude: aSimuler.latitudeLivraison!, longitude: aSimuler.longitudeLivraison! })} />
      ) : null}
      {simulation ? <Bouton titre="Arrêter la simulation" variante="discret" onPress={arreterSimulation} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  carte: {
    gap: 8,
    padding: 16,
    borderRadius: theme.rayon,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.bordure,
  },
  entete: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  point: { width: 10, height: 10, borderRadius: 5 },
  titre: { fontSize: 16, fontWeight: '800', color: theme.texte },
  texte: { fontSize: 14, color: theme.secondaire },
  erreur: { fontSize: 14, color: theme.erreur },
  demo: { fontSize: 12, fontWeight: '700', color: '#FBBF24' },
});
