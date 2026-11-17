import Ionicons from '@expo/vector-icons/Ionicons';
import { libelleEtape, resumeOffre, type LotLivreur } from '@fleetpulse/shared';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme';

// US-404 : ordre des collectes et des livraisons du lot accepte (l'adresse du client apparait apres la collecte)
export function CarteItineraire({ lot }: { lot: LotLivreur }) {
  return (
    <View style={styles.carte}>
      <View style={styles.entete}>
        <Ionicons name="git-network-outline" size={18} color={theme.accent} />
        <Text style={styles.titre}>Itinéraire du lot n°{lot.id}</Text>
      </View>
      <Text style={styles.resume}>{resumeOffre({ nbCommandes: lot.commandes.length, distanceKm: lot.distanceKm, dureeMinutes: lot.dureeMinutes })}</Text>
      {lot.etapes.map((e) => (
        <View key={e.ordre} style={styles.ligne}>
          <Ionicons name={e.type === 'COLLECTE' ? 'storefront-outline' : 'home-outline'} size={14} color={theme.secondaire} />
          <Text style={styles.etape} numberOfLines={2}>{libelleEtape(e)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { gap: 8, padding: 16, borderRadius: theme.rayon, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.bordure },
  entete: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titre: { fontSize: 15, fontWeight: '700', color: theme.texte },
  resume: { fontSize: 13, color: theme.secondaire },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  etape: { flex: 1, fontSize: 13, color: theme.texte },
});
