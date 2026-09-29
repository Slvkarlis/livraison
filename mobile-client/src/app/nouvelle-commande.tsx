import {
  Bouton,
  Champ,
  MODES_PAIEMENT,
  MessageErreur,
  api,
  couleurs,
  formatHeure,
  formatJour,
} from '@fleetpulse/shared';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type LatLng } from 'react-native-maps';
import { ACCENT, TUNIS } from '../theme';

type Creneau = { debut: Date; fin: Date };

const DUREE_CRENEAU_H = 2;
const PREMIERE_HEURE = 8;
const DERNIERE_HEURE_DEBUT = 20;

/** Prochains creneaux de 2 h entre 8 h et 22 h, au plus tot a l'heure pleine suivante. */
function prochainsCreneaux(nombre = 6): Creneau[] {
  const creneaux: Creneau[] = [];
  const debut = new Date();
  debut.setMinutes(0, 0, 0);
  debut.setHours(debut.getHours() + 1);
  while (creneaux.length < nombre) {
    const heure = debut.getHours();
    if (heure >= PREMIERE_HEURE && heure <= DERNIERE_HEURE_DEBUT) {
      const fin = new Date(debut);
      fin.setHours(fin.getHours() + DUREE_CRENEAU_H);
      creneaux.push({ debut: new Date(debut), fin });
      debut.setHours(debut.getHours() + DUREE_CRENEAU_H);
    } else {
      debut.setHours(debut.getHours() + 1);
    }
  }
  return creneaux;
}

function adresseLisible(a: Location.LocationGeocodedAddress): string {
  if (a.formattedAddress) return a.formattedAddress;
  const rue = [a.streetNumber, a.street].filter(Boolean).join(' ') || a.name;
  return [rue, a.district, a.postalCode, a.city].filter(Boolean).join(', ');
}

// US-05 (adresse + GPS) et US-06 (creneau + mode de paiement)
export default function NouvelleCommande() {
  const carte = useRef<MapView>(null);
  const creneaux = useMemo(() => prochainsCreneaux(), []);
  const [position, setPosition] = useState<LatLng | null>(null);
  const [adresse, setAdresse] = useState('');
  const [adresseSaisie, setAdresseSaisie] = useState(false);
  const [creneau, setCreneau] = useState<Creneau | null>(null);
  const [montant, setMontant] = useState('');
  const [localisation, setLocalisation] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function placer(coordonnees: LatLng, remplacerAdresse = !adresseSaisie) {
    setPosition(coordonnees);
    if (!remplacerAdresse) return;
    try {
      const [resultat] = await Location.reverseGeocodeAsync(coordonnees);
      if (resultat) {
        setAdresse(adresseLisible(resultat));
        setAdresseSaisie(false);
      }
    } catch {
      // Geocodage indisponible : le client saisit l'adresse a la main.
    }
  }

  async function utiliserMaPosition() {
    setErreur(null);
    setLocalisation(true);
    try {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) {
        setErreur('Autorisez la localisation, ou touchez la carte pour placer votre adresse.');
        return;
      }
      const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coordonnees = { latitude: coords.latitude, longitude: coords.longitude };
      carte.current?.animateToRegion({ ...coordonnees, latitudeDelta: 0.005, longitudeDelta: 0.005 });
      await placer(coordonnees, true);
    } catch {
      setErreur('Position introuvable. Touchez la carte pour placer votre adresse.');
    } finally {
      setLocalisation(false);
    }
  }

  async function commander() {
    const valeur = Number(montant.replace(',', '.'));
    const probleme = !adresse.trim() ? 'Indiquez votre adresse de livraison.'
      : !position ? 'Placez le repère sur la carte ou utilisez votre position.'
      : !creneau ? 'Choisissez un créneau de livraison.'
      : !montant.trim() || !Number.isFinite(valeur) || valeur < 0 ? 'Indiquez un montant valide.'
      : null;
    if (probleme || !position || !creneau) {
      setErreur(probleme);
      return;
    }
    setErreur(null);
    setEnvoi(true);
    try {
      const livraison = await api.creerLivraison({
        adresse: adresse.trim(),
        latitude: position.latitude,
        longitude: position.longitude,
        creneauDebut: creneau.debut.toISOString(),
        creneauFin: creneau.fin.toISOString(),
        modePaiement: 'COD',
        montantACollecter: Math.round(valeur * 1000) / 1000,
      });
      router.replace(`/commande/${livraison.id}`);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Commande impossible.');
      setEnvoi(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
        <Text style={styles.section}>Adresse de livraison</Text>
        <View style={styles.carteGeo}>
          <MapView
            ref={carte}
            style={StyleSheet.absoluteFill}
            initialRegion={{ ...TUNIS, latitudeDelta: 0.08, longitudeDelta: 0.08 }}
            onPress={(e) => placer(e.nativeEvent.coordinate)}
            showsUserLocation
          >
            {position ? (
              <Marker
                coordinate={position}
                pinColor={ACCENT}
                draggable
                onDragEnd={(e) => placer(e.nativeEvent.coordinate)}
              />
            ) : null}
          </MapView>
        </View>
        <Text style={styles.aide}>
          {position ? 'Déplacez le repère pour ajuster la position.' : 'Touchez la carte pour placer votre adresse.'}
        </Text>
        <Bouton
          titre="Utiliser ma position"
          variante="secondaire"
          onPress={utiliserMaPosition}
          chargement={localisation}
          style={styles.position}
        />
        <Champ
          libelle="Adresse"
          value={adresse}
          onChangeText={(texte) => { setAdresse(texte); setAdresseSaisie(true); }}
          placeholder="Rue, numéro, ville"
          multiline
          style={styles.adresse}
        />

        <Text style={styles.section}>Créneau</Text>
        <View style={styles.creneaux}>
          {creneaux.map((c) => {
            const actif = creneau?.debut.getTime() === c.debut.getTime();
            return (
              <Pressable
                key={c.debut.toISOString()}
                onPress={() => setCreneau(c)}
                style={[styles.creneau, actif && { borderColor: ACCENT, backgroundColor: '#EEF2FF' }]}
              >
                <Text style={[styles.creneauJour, actif && { color: ACCENT }]}>{formatJour(c.debut)}</Text>
                <Text style={[styles.creneauHeure, actif && { color: ACCENT }]}>
                  {formatHeure(c.debut)} – {formatHeure(c.fin)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.section}>Paiement</Text>
        <View style={[styles.paiement, { borderColor: ACCENT }]}>
          <Text style={[styles.paiementTexte, { color: ACCENT }]}>{MODES_PAIEMENT.COD}</Text>
        </View>
        <Champ
          libelle="Montant à régler au livreur (DT)"
          value={montant}
          onChangeText={setMontant}
          keyboardType="decimal-pad"
          placeholder="0,000"
        />

        <MessageErreur message={erreur} />
        <Bouton titre="Valider la commande" onPress={commander} chargement={envoi} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: couleurs.fond },
  contenu: { padding: 20, paddingBottom: 40 },
  section: { fontSize: 17, fontWeight: '600', color: couleurs.texte, marginBottom: 12, marginTop: 8 },
  carteGeo: { height: 220, borderRadius: 16, overflow: 'hidden', backgroundColor: couleurs.surface },
  aide: { fontSize: 13, color: couleurs.secondaire, marginTop: 8 },
  position: { marginTop: 12, marginBottom: 16 },
  adresse: { height: 72, paddingTop: 12, textAlignVertical: 'top' },
  creneaux: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  creneau: {
    width: '48%',
    flexGrow: 1,
    borderWidth: 1,
    borderColor: couleurs.bordure,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  creneauJour: { fontSize: 13, color: couleurs.secondaire },
  creneauHeure: { fontSize: 16, fontWeight: '600', color: couleurs.texte, marginTop: 2 },
  paiement: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 16, backgroundColor: '#EEF2FF' },
  paiementTexte: { fontSize: 15, fontWeight: '600' },
});
