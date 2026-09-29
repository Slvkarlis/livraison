import Ionicons from '@expo/vector-icons/Ionicons';
import { Bouton, Champ, MessageErreur } from '@fleetpulse/shared';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { definirAdresse, useAdresseChoisie } from '../brouillon';
import { CarteLeaflet, type CarteLeafletRef, type Point } from '../composants/CarteLeaflet';
import { TUNIS, theme } from '../theme';

const ZOOM_RUE = 17;

function adresseLisible(a: Location.LocationGeocodedAddress): string {
  if (a.formattedAddress) return a.formattedAddress;
  const rue = [a.streetNumber, a.street].filter(Boolean).join(' ') || a.name;
  return [rue, a.district, a.postalCode, a.city].filter(Boolean).join(', ');
}

/** US-05 : le client place son adresse en deplacant la carte sous un repere fixe au centre. */
export default function ChoisirAdresse() {
  const insets = useSafeAreaInsets();
  const carte = useRef<CarteLeafletRef>(null);
  const existante = useAdresseChoisie();
  const [centre, setCentre] = useState(existante ?? TUNIS);
  const [adresse, setAdresse] = useState(existante?.adresse ?? '');
  const [recherche, setRecherche] = useState(false);
  const [deplacement, setDeplacement] = useState(false);
  const [localisation, setLocalisation] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);


  async function maPosition(demander: boolean) {
    setErreur(null);
    setLocalisation(true);
    try {
      const permission = demander
        ? await Location.requestForegroundPermissionsAsync()
        : await Location.getForegroundPermissionsAsync();
      if (!permission.granted) {
        if (demander) setErreur('Localisation refusée : déplacez la carte pour placer le repère.');
        return;
      }
      const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const point = { latitude: coords.latitude, longitude: coords.longitude };
      carte.current?.afficherMaPosition(point);
      carte.current?.allerA(point, ZOOM_RUE);
    } catch {
      if (demander) setErreur('Position introuvable : déplacez la carte pour placer le repère.');
    } finally {
      setLocalisation(false);
    }
  }

  async function surFinDeplacement(point: Point) {
    setDeplacement(false);
    setCentre(point);
    setRecherche(true);
    try {
      const [resultat] = await Location.reverseGeocodeAsync(point);
      if (resultat) setAdresse(adresseLisible(resultat));
    } catch {
      // Geocodage indisponible : le client saisit l'adresse lui-meme.
    } finally {
      setRecherche(false);
    }
  }

  function confirmer() {
    if (!adresse.trim()) {
      setErreur('Indiquez l’adresse (rue, numéro, ville).');
      return;
    }
    definirAdresse({ adresse: adresse.trim(), latitude: centre.latitude, longitude: centre.longitude });
    router.back();
  }

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.zoneCarte}>
        <CarteLeaflet
          ref={carte}
          style={StyleSheet.absoluteFill}
          centre={centre}
          zoom={existante ? ZOOM_RUE : 13}
          // Premiere ouverture : on centre sur le client si la localisation est deja autorisee.
          onPret={() => { if (!existante) void maPosition(false); }}
          onDeplacementDebut={() => setDeplacement(true)}
          onDeplacementFin={surFinDeplacement}
        />
        <View pointerEvents="none" style={styles.repere}>
          <Ionicons name="location" size={46} color={theme.accent} />
          <View style={[styles.ombreRepere, deplacement && styles.ombreLevee]} />
        </View>
        <Pressable
          accessibilityLabel="Ma position"
          onPress={() => maPosition(true)}
          style={styles.boutonPosition}
        >
          <Ionicons name={localisation ? 'hourglass-outline' : 'locate'} size={22} color={theme.accent} />
        </Pressable>
      </View>

      <View style={[styles.panneau, { paddingBottom: insets.bottom + 16 }]}>
        <Text style={styles.aide}>
          {deplacement ? 'Relâchez pour placer le repère…' : recherche ? 'Recherche de l’adresse…' : 'Déplacez la carte pour ajuster le repère.'}
        </Text>
        <MessageErreur message={erreur} />
        <Champ
          libelle="Adresse"
          value={adresse}
          onChangeText={setAdresse}
          placeholder="Rue, numéro, ville"
        />
        <Bouton titre="Confirmer cette adresse" onPress={confirmer} desactive={deplacement} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.surface },
  zoneCarte: { flex: 1 },
  repere: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -23,
    marginTop: -46,
    alignItems: 'center',
  },
  ombreRepere: { width: 10, height: 4, borderRadius: 5, backgroundColor: 'rgba(23,21,43,0.3)', marginTop: -4 },
  ombreLevee: { width: 6, opacity: 0.5 },
  boutonPosition: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  panneau: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  aide: { fontSize: 14, color: theme.secondaire, marginBottom: 12 },
});
