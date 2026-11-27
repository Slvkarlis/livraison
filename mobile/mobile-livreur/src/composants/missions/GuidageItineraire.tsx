import Ionicons from '@expo/vector-icons/Ionicons';
import {
  Bouton, Pressionnable, calculerItineraire, doitRecalculer, memesArrets, progression, useConfiguration,
  type Coord, type ItineraireRoutier, type Mission,
} from '@fleetpulse/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme';
import type { EtatNavigation } from '../navigation/carteNavigationPage';
import { POSITIONS_DEMO } from '../position';
import { useSuiviPosition } from '../suivi/SuiviPosition';

/** Navigation guidee dans l'application de cartes du telephone (recalcul automatique en cas d'ecart). */
export function lienNavigation(cible: Coord): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${cible[1]},${cible[0]}&travelmode=driving&dir_action=navigate`;
}

/**
 * Guidage routier de la mission, comme un GPS : des l'acceptation, itineraire vers le commerce ;
 * colis a bord, itineraire vers le client. Si le livreur s'ecarte du trace, un nouveau trajet est calcule
 * depuis sa position. Le responsable voit le meme itineraire sur sa carte de suivi.
 */
export function useGuidage(mission: Mission | null) {
  const { position } = useSuiviPosition();
  const enRoute = mission?.statut === 'RECUPEREE' || mission?.statut === 'A_PROXIMITE';
  const lng = enRoute ? mission?.longitudeLivraison : mission?.longitudeCommerce;
  const lat = enRoute ? mission?.latitudeLivraison : mission?.latitudeCommerce;
  const cible = useMemo<Coord | null>(() => (lng != null && lat != null ? [lng, lat] : null), [lng, lat]);
  const ici = useMemo<Coord | null>(() => (position ? [position.longitude, position.latitude] : null), [position]);

  const [itineraire, setItineraire] = useState<ItineraireRoutier>();
  const [recalculs, setRecalculs] = useState(0);
  const enCours = useRef(false);

  useEffect(() => {
    if (!ici || !cible || enCours.current || !doitRecalculer(itineraire, ici, [cible])) return;
    enCours.current = true;
    const nouvelObjectif = !memesArrets(itineraire, [cible]);
    void calculerItineraire(ici, [cible]).then((it) => {
      setItineraire(it);
      setRecalculs((n) => (nouvelObjectif ? 0 : n + 1));
    }).finally(() => { enCours.current = false; });
  }, [ici, cible, itineraire]);

  const avancee = useMemo(() => (itineraire && ici && memesArrets(itineraire, cible ? [cible] : []) ? progression(itineraire, ici) : null),
    [itineraire, ici, cible]);
  const carte = useMemo<EtatNavigation | null>(() => (cible ? {
    position: ici, cible, typeCible: enRoute ? 'client' : 'commerce',
    restant: avancee?.restant ?? [], complet: avancee ? itineraire!.points : [],
  } : null), [cible, ici, enRoute, avancee, itineraire]);
  const destination = enRoute ? `le client (${mission?.clientPrenom ?? ''})` : mission?.nomCommerce ?? 'le commerce';
  return { cible, ici, itineraire, avancee, recalculs, enRoute, destination, carte };
}

export type Guidage = ReturnType<typeof useGuidage>;

/** Bandeau de consigne affiche en haut de la carte, comme un GPS. */
export function BandeauConsigne({ guidage }: { guidage: Guidage }) {
  const { avancee, ici } = guidage;
  const texte = !ici ? 'En attente de votre position GPS…' : !avancee ? 'Calcul de l’itinéraire…'
    : avancee.horsItineraire ? 'Vous avez quitté l’itinéraire : nouveau trajet en cours…'
      : avancee.prochaine?.instruction ?? `Continuez vers ${guidage.destination}`;
  const icone = avancee?.horsItineraire ? 'refresh' : /gauche/.test(texte) ? 'arrow-undo' : /droite/.test(texte) ? 'arrow-redo'
    : /arrivé/.test(texte) ? 'flag' : 'arrow-up';
  return (
    <View style={[styles.bandeau, avancee?.horsItineraire && styles.bandeauAlerte]}>
      <Ionicons name={icone} size={26} color="#FFFFFF" />
      <View style={{ flex: 1 }}>
        {avancee?.prochaine && !avancee.horsItineraire ? <Text style={styles.bandeauDistance}>{formaterMetres(avancee.prochaine.distanceM)}</Text> : null}
        <Text style={styles.bandeauTexte} numberOfLines={2}>{texte}</Text>
      </View>
    </View>
  );
}

function formaterMetres(m: number): string {
  return m >= 1000 ? `${(m / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km` : `${Math.round(m / 10) * 10} m`;
}

/** Resume du trajet sous la carte : temps, distance, navigation externe et simulation de demonstration. */
export function GuidageItineraire({ mission, guidage }: { mission: Mission; guidage: Guidage }) {
  const { demonstration } = useConfiguration();
  const { position, simulation, simuler } = useSuiviPosition();
  const { cible, ici, itineraire, avancee, recalculs, enRoute, destination } = guidage;
  if (!cible) return null;

  return (
    <View style={styles.carte}>
      <View style={styles.entete}>
        <Ionicons name={enRoute ? 'home' : 'storefront'} size={16} color={theme.accent} />
        <Text style={styles.titre} numberOfLines={1}>Itinéraire vers {destination}</Text>
      </View>

      {!ici ? (
        <Text style={styles.discret}>En attente de votre position GPS pour calculer l’itinéraire…</Text>
      ) : !itineraire || !avancee ? (
        <Text style={styles.discret}>Calcul de l’itinéraire…</Text>
      ) : (
        <>
          <View style={styles.mesures}>
            <Text style={styles.grand}>{avancee.resteMin}<Text style={styles.unite}> min</Text></Text>
            <Text style={styles.grand}>{avancee.resteKm.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}<Text style={styles.unite}> km</Text></Text>
          </View>
          <Text style={styles.discret}>
            {itineraire.source === 'osrm' ? 'Itinéraire par les rues, recalculé si vous vous en écartez' : 'Service d’itinéraire injoignable : direction indicative'}
            {recalculs ? ` · ${recalculs} recalcul(s)` : ''}.
          </Text>
        </>
      )}

      <Pressionnable onPress={() => void Linking.openURL(lienNavigation(cible))} accessibilityRole="link"
        accessibilityLabel={`Ouvrir la navigation vers ${destination} dans Google Maps`} style={styles.naviguer}>
        <Ionicons name="navigate" size={16} color={theme.surAccent} />
        <Text style={styles.naviguerTexte}>Ouvrir dans Google Maps</Text>
      </Pressionnable>
      {demonstration && !simulation ? (
        <Bouton titre={enRoute ? 'Simuler le trajet vers le client' : 'Simuler le trajet vers le commerce'} variante="secondaire"
          onPress={() => {
            const depart = enRoute && mission.latitudeCommerce != null && mission.longitudeCommerce != null
              ? { latitude: mission.latitudeCommerce, longitude: mission.longitudeCommerce } : position ?? POSITIONS_DEMO[0].position;
            simuler(depart, { latitude: cible[1], longitude: cible[0] });
          }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { backgroundColor: '#1B1C1F', borderRadius: 24, padding: 18, marginTop: 14, gap: 10 },
  entete: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titre: { flex: 1, fontSize: 15, fontWeight: '800', color: theme.texte },
  mesures: { flexDirection: 'row', gap: 24 },
  grand: { fontSize: 28, fontWeight: '800', color: theme.texte, letterSpacing: -0.5 },
  unite: { fontSize: 14, fontWeight: '600', color: theme.secondaire },
  discret: { fontSize: 12.5, color: theme.secondaire },
  naviguer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 999, backgroundColor: theme.accent },
  naviguerTexte: { fontSize: 15, fontWeight: '800', color: theme.surAccent },
  bandeau: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 18,
    backgroundColor: '#0B6B4F', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6 },
  bandeauAlerte: { backgroundColor: '#B3261E' },
  bandeauDistance: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  bandeauTexte: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
